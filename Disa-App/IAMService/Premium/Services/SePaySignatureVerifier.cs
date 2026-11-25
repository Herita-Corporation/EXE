
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace IAMService.Premium.Services;

public sealed class SePaySignatureVerifier
{
    private readonly IConfiguration _configuration;

    public SePaySignatureVerifier(
        IConfiguration configuration)
    {
        _configuration = configuration;
    }

    // ==========================================
    // VERIFY SEPAY HMAC SHA256
    // ==========================================
    public bool Verify(
        byte[] rawBody,
        string timestamp,
        string signature)
    {
        string? secret =
            _configuration["SePay:WebhookSecret"];

        if (string.IsNullOrWhiteSpace(secret))
            return false;

        // Validate Unix timestamp.
        if (!long.TryParse(
            timestamp,
            NumberStyles.None,
            CultureInfo.InvariantCulture,
            out long unixTimestamp))
        {
            return false;
        }

        DateTimeOffset signedAt;

        try
        {
            signedAt = DateTimeOffset
                .FromUnixTimeSeconds(unixTimestamp);
        }
        catch (ArgumentOutOfRangeException)
        {
            return false;
        }

        // Allow +/- 5 minutes.
        double seconds = Math.Abs(
            (DateTimeOffset.UtcNow - signedAt)
            .TotalSeconds);

        if (seconds > 300)
            return false;

        const string prefix = "sha256=";

        if (!signature.StartsWith(
            prefix,
            StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        string hashHex =
            signature[prefix.Length..];

        byte[] receivedHash;

        try
        {
            receivedHash =
                Convert.FromHexString(hashHex);
        }
        catch (FormatException)
        {
            return false;
        }

        // Original signed message:
        // timestamp + "." + raw HTTP body.
        byte[] timeBytes =
            Encoding.UTF8.GetBytes(timestamp + ".");

        byte[] message = new byte[
            timeBytes.Length + rawBody.Length];

        Buffer.BlockCopy(
            timeBytes,
            0,
            message,
            0,
            timeBytes.Length);

        Buffer.BlockCopy(
            rawBody,
            0,
            message,
            timeBytes.Length,
            rawBody.Length);

        byte[] expectedHash =
            HMACSHA256.HashData(
                Encoding.UTF8.GetBytes(secret),
                message);

        return CryptographicOperations.FixedTimeEquals(
            expectedHash,
            receivedHash);
    }
}
