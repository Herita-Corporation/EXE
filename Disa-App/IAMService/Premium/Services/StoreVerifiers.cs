using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Google.Apis.Auth.OAuth2;

namespace IAMService.Premium.Services;
public record StorePurchase(string TransactionId, string ProductId, DateTime PurchasedUtc, bool Revoked = false);

// Google Play Console: create ONE-TIME IN-APP products of type consumable (not subscriptions).
// For subscriptions instead, replace with purchases.subscriptionsv2.get and implement RTDN/lifecycle.
public sealed class GooglePlayVerifier(IConfiguration cfg, IHttpClientFactory factory)
{
    public async Task<StorePurchase> VerifyAsync(string productId, string purchaseToken, CancellationToken ct)
    {
        var package = cfg["GooglePlay:PackageName"] ?? throw new InvalidOperationException("GooglePlay:PackageName missing");
        var credentialFile = cfg["GooglePlay:ServiceAccountJsonPath"] ?? throw new InvalidOperationException("Google service account missing");
        var credential = GoogleCredential.FromFile(credentialFile).CreateScoped("https://www.googleapis.com/auth/androidpublisher");
        var token = await credential.UnderlyingCredential.GetAccessTokenForRequestAsync(cancellationToken: ct);
        using var req = new HttpRequestMessage(HttpMethod.Get,
            $"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{Uri.EscapeDataString(package)}/purchases/products/{Uri.EscapeDataString(productId)}/tokens/{Uri.EscapeDataString(purchaseToken)}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await factory.CreateClient().SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var e = body.RootElement;
        if (e.GetProperty("purchaseState").GetInt32() != 0) throw new InvalidOperationException("Google purchase not completed");
        if (e.TryGetProperty("consumptionState", out var consumed) && consumed.GetInt32() == 1)
            throw new InvalidOperationException("Already consumed purchase; reconcile with local record");
        var order = e.TryGetProperty("orderId", out var o) ? o.GetString() : null;
        if (string.IsNullOrWhiteSpace(order)) throw new InvalidOperationException("Missing orderId");
        var ms = long.Parse(e.GetProperty("purchaseTimeMillis").GetString()!);
        return new StorePurchase(order, productId, DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime);
    }
    public async Task ConsumeAsync(string productId, string purchaseToken, CancellationToken ct)
    {
        var package = cfg["GooglePlay:PackageName"]!;
        var credential = GoogleCredential.FromFile(cfg["GooglePlay:ServiceAccountJsonPath"]!).CreateScoped("https://www.googleapis.com/auth/androidpublisher");
        var token = await credential.UnderlyingCredential.GetAccessTokenForRequestAsync(cancellationToken: ct);
        using var req = new HttpRequestMessage(HttpMethod.Post,
            $"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{Uri.EscapeDataString(package)}/purchases/products/{Uri.EscapeDataString(productId)}/tokens/{Uri.EscapeDataString(purchaseToken)}:consume");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await factory.CreateClient().SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
    }
}

// Verify StoreKit 2 signedTransactionInfo. Only trust a certificate chain anchored to
// Apple's App Store root CA configured as a local PEM, not an arbitrary x5c chain.
// Validate identifiers and revocation in addition to crypto signature.
public sealed class AppleStoreVerifier(IConfiguration cfg)
{
    private static byte[] Decode64(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight((s.Length + 3) / 4 * 4, '='));
    }
    public StorePurchase Verify(string jws)
    {
        var pieces = jws.Split('.');
        if (pieces.Length != 3) throw new InvalidOperationException("Invalid Apple JWS");
        using var head = JsonDocument.Parse(Decode64(pieces[0]));
        if (head.RootElement.GetProperty("alg").GetString() != "ES256") throw new InvalidOperationException("Invalid signing algorithm");
        var chainJson = head.RootElement.GetProperty("x5c");
        if (chainJson.GetArrayLength() < 2) throw new InvalidOperationException("Apple certificate chain missing");
        var certs = chainJson.EnumerateArray().Select(x => new X509Certificate2(Convert.FromBase64String(x.GetString()!))).ToArray();
        var rootPath = cfg["Apple:RootCertificatePemPath"] ?? throw new InvalidOperationException("Apple root PEM not configured");
        using var root = X509Certificate2.CreateFromPemFile(rootPath);
        using var chain = new X509Chain();
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.CustomTrustStore.Add(root);
        chain.ChainPolicy.RevocationMode = X509RevocationMode.Online;
        chain.ChainPolicy.RevocationFlag = X509RevocationFlag.EntireChain;
        chain.ChainPolicy.UrlRetrievalTimeout = TimeSpan.FromSeconds(10);
        foreach (var c in certs.Skip(1)) chain.ChainPolicy.ExtraStore.Add(c);
        if (!chain.Build(certs[0])) throw new InvalidOperationException("Untrusted Apple certificate chain");
        using var pub = certs[0].GetECDsaPublicKey() ?? throw new InvalidOperationException("No ECDSA key");
        var data = Encoding.ASCII.GetBytes(pieces[0] + "." + pieces[1]);
        if (!pub.VerifyData(data, Decode64(pieces[2]), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation))
            throw new InvalidOperationException("Invalid Apple JWS signature");
        using var payload = JsonDocument.Parse(Decode64(pieces[1]));
        var e = payload.RootElement;
        if (e.GetProperty("bundleId").GetString() != cfg["Apple:BundleId"]) throw new InvalidOperationException("BundleId mismatch");
        var environment = e.GetProperty("environment").GetString();
        if (environment != cfg["Apple:Environment"]) throw new InvalidOperationException("Apple environment mismatch");
        if (e.TryGetProperty("revocationDate", out var revoke) && revoke.ValueKind != JsonValueKind.Null)
            throw new InvalidOperationException("Apple transaction revoked");
        var id = e.GetProperty("transactionId").GetString()!;
        var product = e.GetProperty("productId").GetString()!;
        var ms = e.GetProperty("purchaseDate").GetInt64();
        return new StorePurchase(id, product, DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime);
    }
}
