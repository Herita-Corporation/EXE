namespace Task.Domain.Entities
{
    public class VoucherRedemption
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }

        public Guid VoucherId { get; set; }

        public DateTime RedeemedAt { get; set; } = DateTime.UtcNow;

        public Voucher Voucher { get; set; } = null!;
    }
}
