namespace IAM.Infrastructure.Data.Entities;

public class PartnerProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string BusinessName { get; set; } = "";
    public string BusinessType { get; set; } = "";
    public string OwnerName { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public string Email { get; set; } = "";
    public string Address { get; set; } = "";
    public string? TaxCode { get; set; }
    public string? BusinessLicenseUrl { get; set; }
    public string Status { get; set; } = "PendingApproval";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<PartnerContentRequest> Requests { get; set; } = new List<PartnerContentRequest>();
}
