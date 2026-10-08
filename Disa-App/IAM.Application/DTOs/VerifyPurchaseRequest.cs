namespace IAM.Application.DTOs.Requests;

public class VerifyPurchaseRequest
{
    public string ProductId { get; set; } = null!;
    public string PurchaseToken { get; set; } = null!;
}
