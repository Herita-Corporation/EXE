namespace Task.Application.DTOs.Responses;

public class OwnedVoucherResponse
{
    public Guid RedemptionId { get; set; }

    public Guid VoucherId { get; set; }

    public string Category { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string ImageUrl { get; set; } = string.Empty;

    public string Code { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public DateTime RedeemedAt { get; set; }
}
