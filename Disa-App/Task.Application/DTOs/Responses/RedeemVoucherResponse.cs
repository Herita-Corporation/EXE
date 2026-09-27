namespace Task.Application.DTOs.Responses;

public class RedeemVoucherResponse
{
    public Guid RedemptionId { get; set; }

    public int RemainingPoints { get; set; }
}
