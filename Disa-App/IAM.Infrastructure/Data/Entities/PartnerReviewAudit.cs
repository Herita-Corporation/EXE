namespace IAM.Infrastructure.Data.Entities;

public class PartnerReviewAudit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequestId { get; set; }
    public PartnerContentRequest Request { get; set; } = null!;
    public Guid AdminId { get; set; }
    public string OldStatus { get; set; } = "";
    public string NewStatus { get; set; } = "";
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
