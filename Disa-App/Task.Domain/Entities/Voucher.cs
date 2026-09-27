namespace Task.Domain.Entities
{
    public class Voucher
    {
        public Guid Id { get; set; }

        public string Category { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string ImageUrl { get; set; } = string.Empty;

        public int PointsCost { get; set; }

        public string DiscountLabel { get; set; } = string.Empty;

        public string Location { get; set; } = string.Empty;

        public DateTime ExpiresAt { get; set; }

        public string Code { get; set; } = string.Empty;

        // JSON string array — see VoucherService for (de)serialization.
        public string TermsJson { get; set; } = "[]";

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<VoucherRedemption> Redemptions { get; set; } = new List<VoucherRedemption>();
    }
}
