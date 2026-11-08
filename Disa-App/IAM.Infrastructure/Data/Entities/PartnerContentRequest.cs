namespace IAM.Infrastructure.Data.Entities;

public class PartnerContentRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PartnerId { get; set; }
    public PartnerProfile Partner { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public decimal? Price { get; set; }
    public TimeOnly? OpeningTime { get; set; }
    public TimeOnly? ClosingTime { get; set; }
    public string Location { get; set; } = "";
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string Status { get; set; } = "Draft";
    public string? RejectReason { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<PartnerRequestImage> Images { get; set; } = new List<PartnerRequestImage>();
}
