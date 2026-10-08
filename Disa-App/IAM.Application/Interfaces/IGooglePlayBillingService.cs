namespace IAM.Application.Interfaces;

/// <summary>
/// Current state of a Google Play subscription purchase, as reported by the
/// Google Play Developer API — just the fields PremiumController needs to
/// decide whether/how long a user stays Premium.
/// </summary>
public record GooglePlaySubscriptionStatus(
    bool IsActive,
    DateTime ExpiresAt,
    bool AcknowledgementRequired
);

public interface IGooglePlayBillingService
{
    Task<GooglePlaySubscriptionStatus> GetSubscriptionAsync(string productId, string purchaseToken);

    Task AcknowledgeSubscriptionAsync(string productId, string purchaseToken);
}
