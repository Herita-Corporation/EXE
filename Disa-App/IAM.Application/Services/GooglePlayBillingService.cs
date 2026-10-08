using Google.Apis.AndroidPublisher.v3;
using Google.Apis.AndroidPublisher.v3.Data;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Services;
using IAM.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace IAM.Application.Services;

// Colocated with SmtpEmailSender here (not IAM.Infrastructure) — see
// FileStorageService's comment: IAM's layering is Application -> Infrastructure,
// the reverse of the usual chain.
public class GooglePlayBillingService : IGooglePlayBillingService
{
    private readonly IConfiguration _configuration;

    public GooglePlayBillingService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    private AndroidPublisherService BuildClient()
    {
        var keyPath = _configuration["GooglePlay:ServiceAccountKeyPath"];
        if (string.IsNullOrWhiteSpace(keyPath) || !File.Exists(keyPath))
            throw new InvalidOperationException(
                "Google Play chưa được cấu hình — thiếu file service account tại GooglePlay:ServiceAccountKeyPath.");

        var credential = GoogleCredential.FromFile(keyPath)
            .CreateScoped(AndroidPublisherService.Scope.Androidpublisher);

        return new AndroidPublisherService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "DISA Travel",
        });
    }

    private string PackageName =>
        _configuration["GooglePlay:PackageName"] ?? "com.disa.travel.frontend";

    // Modern purchases.subscriptionsv2.get — identified purely by purchaseToken
    // (product-agnostic: one purchase token can only ever belong to one
    // product line, so productId is only used to pick the right line item
    // out of the response, not part of the request itself).
    public async Task<GooglePlaySubscriptionStatus> GetSubscriptionAsync(string productId, string purchaseToken)
    {
        using var client = BuildClient();
        SubscriptionPurchaseV2 purchase = await client.Purchases.Subscriptionsv2
            .Get(PackageName, purchaseToken)
            .ExecuteAsync();

        var lineItem = purchase.LineItems?.FirstOrDefault(li => li.ProductId == productId)
            ?? purchase.LineItems?.FirstOrDefault();

        var expiresAt = lineItem?.ExpiryTimeDateTimeOffset?.UtcDateTime ?? DateTime.UtcNow;

        // ACTIVE / IN_GRACE_PERIOD / CANCELED all still grant access until
        // expiry — only EXPIRED/REVOKED/PAUSED actually cut the user off.
        var state = purchase.SubscriptionState;
        var isActive = state is "SUBSCRIPTION_STATE_ACTIVE"
            or "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
            or "SUBSCRIPTION_STATE_CANCELED";

        var acknowledgementRequired = purchase.AcknowledgementState == "ACKNOWLEDGEMENT_STATE_PENDING";

        return new GooglePlaySubscriptionStatus(isActive, expiresAt, acknowledgementRequired);
    }

    // Acknowledgement is still only exposed on the classic v1 subscriptions
    // resource (subscriptionsv2 has no separate acknowledge endpoint) — must
    // be called within 3 days of purchase or Google auto-refunds it.
    public async Task AcknowledgeSubscriptionAsync(string productId, string purchaseToken)
    {
        using var client = BuildClient();
        await client.Purchases.Subscriptions
            .Acknowledge(new SubscriptionPurchasesAcknowledgeRequest(), PackageName, productId, purchaseToken)
            .ExecuteAsync();
    }
}
