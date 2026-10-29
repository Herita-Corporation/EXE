namespace IAM.Infrastructure.Data.Entities;

public class PartnerRequestImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequestId { get; set; }
    public PartnerContentRequest Request { get; set; } = null!;
    public string ImageUrl { get; set; } = "";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
