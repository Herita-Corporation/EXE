namespace IAM.Infrastructure.Data.Entities;

public class PartnerInvoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PartnerId { get; set; }
    public PartnerProfile Partner { get; set; } = null!;
    public string InvoiceNumber { get; set; } = "";
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "Unpaid";
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DueAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
