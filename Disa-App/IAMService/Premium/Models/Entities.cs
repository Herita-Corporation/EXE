namespace IAMService.Premium.Models;

public class PremiumPlan
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public int DurationMonths { get; set; }
    public int PriceVnd { get; set; }
    public bool IsActive { get; set; } = true;
    public string GoogleProductId { get; set; } = "";
    public string AppleProductId { get; set; } = "";
}
public class PremiumPayment
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public int PlanId { get; set; }
    public PremiumPlan Plan { get; set; } = null!;
    public string Provider { get; set; } = "";
    public string Status { get; set; } = "PENDING";
    public int AmountVnd { get; set; }
    public string OrderCode { get; set; } = "";
    public string? ProviderTransactionId { get; set; }
    public string? StoreTokenHash { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public DateTime? AccessUntilUtc { get; set; }
}
public class UserPremiumSubscription
{
    public Guid UserId { get; set; }
    public int PlanId { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public long? LastPaymentId { get; set; }
}
public record CreateQrRequest(string PlanCode);
public record VerifyGoogleRequest(string ProductId, string PurchaseToken);
public record VerifyAppleRequest(string SignedTransactionInfo);
