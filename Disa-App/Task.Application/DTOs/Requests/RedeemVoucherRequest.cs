namespace Task.Application.DTOs.Requests;

// Task.Presentation has no auth-derived user identity for most routes (see
// AssignMissionRequest.UserId) — redemption follows the same established
// convention of trusting a client-supplied UserId.
public class RedeemVoucherRequest
{
    public Guid UserId { get; set; }
}
