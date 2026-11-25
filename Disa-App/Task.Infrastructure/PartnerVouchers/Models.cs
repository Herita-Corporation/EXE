using Microsoft.EntityFrameworkCore;

namespace Task.Infrastructure.PartnerVouchers;

public class LocationSnapshot
{
    public Guid Id { get; set; }
    public Guid PartnerId { get; set; }
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string TimeZone { get; set; } = "Asia/Ho_Chi_Minh";
    public string ImageUrl { get; set; } = "";
    public bool Active { get; set; }
    public int Version { get; set; }
}
public class Campaign
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LocationId { get; set; }
    public LocationSnapshot Location { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Terms { get; set; } = "";
    public string DiscountType { get; set; } = "PERCENT";
    public int PercentageBps { get; set; }
    public decimal FixedAmount { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal MinSpend { get; set; }
    public string UsageMode { get; set; } = "IMMEDIATE_OR_LATER";
    public int ValidDays { get; set; } = 30;
    public string AllowedSources { get; set; } = "HOME,ITINERARY,ACQUISITION_QR";
    public string Status { get; set; } = "DRAFT";
    public string DataMode { get; set; } = "INTERNAL_TEST";
    public int TotalQuota { get; set; }
    public int IssuedCount { get; set; }
    public int RedeemedCount { get; set; }
    public DateTime ClaimStartsAt { get; set; }
    public DateTime ClaimEndsAt { get; set; }
    public DateTime RedeemEndsAt { get; set; }
    public string QrKey { get; set; } = Guid.NewGuid().ToString("N");
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class VoucherInstance
{
    public Guid? TripId { get; set; }
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public Campaign Campaign { get; set; } = null!;
    public Guid TravelerId { get; set; }
    public string VoucherRef { get; set; } = "DV-" + Guid.NewGuid().ToString("N");
    public string Status { get; set; } = "ISSUED";
    public string Source { get; set; } = "HOME";
    public DateTime IssuedAt { get; set; }
    public DateTime RedeemableFrom { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RedeemedAt { get; set; }
    public string TermsSnapshotJson { get; set; } = "{}";
}
public class Presentation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VoucherInstanceId { get; set; }
    public VoucherInstance Voucher { get; set; } = null!;
    public string TokenHash { get; set; } = "";
    public string ShortCodeHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public string Status { get; set; } = "ACTIVE";
}
public class Verification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PresentationId { get; set; }
    public Presentation Presentation { get; set; } = null!;
    public Guid StaffId { get; set; }
    public Guid LocationId { get; set; }
    public string TicketHash { get; set; } = "";
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public string? OrderRef { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
}
public class Redemption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VoucherInstanceId { get; set; }
    public VoucherInstance Voucher { get; set; } = null!;
    public Guid LocationId { get; set; }
    public Guid StaffId { get; set; }
    public string ReceiptRef { get; set; } = "DR-" + Guid.NewGuid().ToString("N");
    public string? OrderRef { get; set; }
    public decimal EligibleSubtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal NetAmount { get; set; }
    public DateTime RedeemedAt { get; set; }
    public bool Voided { get; set; }
    public string? VoidReason { get; set; }
}
public class IdempotencyRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActorId { get; set; }
    public string Operation { get; set; } = "";
    public string Key { get; set; } = "";
    public string RequestHash { get; set; } = "";
    public string ResponseJson { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class BusinessEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActorId { get; set; }
    public Guid EntityId { get; set; }
    public string EventType { get; set; } = "";
    public string DataMode { get; set; } = "INTERNAL_TEST";
    public string Detail { get; set; } = "";
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
}
public class AcquisitionContext
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public string TokenHash { get; set; } = "";
    public Guid? BoundUserId { get; set; }
    public DateTime ExpiresAt { get; set; }
}
public class SupportTicket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? VoucherId { get; set; }
    public string Category { get; set; } = "GENERAL";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "OPEN";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class PartnerVoucherModel
{
    public static void Configure(ModelBuilder m)
    {
        m.Entity<LocationSnapshot>().ToTable("PartnerLocationSnapshots", "pv").HasKey(x => x.Id);
        m.Entity<LocationSnapshot>().Property(x => x.Latitude).HasPrecision(10, 7);
        m.Entity<LocationSnapshot>().Property(x => x.Longitude).HasPrecision(10, 7);
        m.Entity<Campaign>().ToTable("Campaigns", "pv", t => t.HasCheckConstraint("CK_PvQuota", "[IssuedCount]>=0 AND [RedeemedCount]>=0 AND [TotalQuota]>=[IssuedCount] AND [IssuedCount]>=[RedeemedCount]"));
        m.Entity<Campaign>().HasOne(x => x.Location).WithMany().HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Campaign>().Property(x => x.QrKey).HasMaxLength(64);
        m.Entity<Campaign>().HasIndex(x => x.QrKey).IsUnique();
        m.Entity<VoucherInstance>().ToTable("VoucherInstances", "pv");
        m.Entity<VoucherInstance>().HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<VoucherInstance>().HasIndex(x => new { x.CampaignId, x.TravelerId }).IsUnique();
        m.Entity<VoucherInstance>().Property(x => x.VoucherRef).HasMaxLength(64);
        m.Entity<VoucherInstance>().HasIndex(x => x.VoucherRef).IsUnique();
        m.Entity<VoucherInstance>().HasIndex(x => new { x.TravelerId, x.Status, x.ExpiresAt });
        m.Entity<Presentation>().ToTable("VoucherPresentations", "pv");
        m.Entity<Presentation>().HasOne(x => x.Voucher).WithMany().HasForeignKey(x => x.VoucherInstanceId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Presentation>().Property(x => x.TokenHash).HasMaxLength(64);
        m.Entity<Presentation>().Property(x => x.ShortCodeHash).HasMaxLength(64);
        m.Entity<Presentation>().Property(x => x.Status).HasMaxLength(20);
        m.Entity<Presentation>().HasIndex(x => x.TokenHash).IsUnique();
        m.Entity<Presentation>().HasIndex(x => x.ShortCodeHash).IsUnique().HasFilter("[Status]='ACTIVE'");
        m.Entity<Presentation>().HasIndex(x => x.VoucherInstanceId).IsUnique().HasFilter("[Status]='ACTIVE'");
        m.Entity<Verification>().ToTable("VoucherVerifications", "pv");
        m.Entity<Verification>().HasOne(x => x.Presentation).WithMany().HasForeignKey(x => x.PresentationId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Verification>().Property(x => x.TicketHash).HasMaxLength(64);
        m.Entity<Verification>().HasIndex(x => x.TicketHash).IsUnique();
        m.Entity<Redemption>().ToTable("Redemptions", "pv");
        m.Entity<Redemption>().HasOne(x => x.Voucher).WithMany().HasForeignKey(x => x.VoucherInstanceId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Redemption>().HasIndex(x => x.VoucherInstanceId).IsUnique();
        m.Entity<IdempotencyRecord>().ToTable("IdempotencyRecords", "pv");
        m.Entity<IdempotencyRecord>().Property(x => x.Operation).HasMaxLength(60);
        m.Entity<IdempotencyRecord>().Property(x => x.Key).HasMaxLength(100);
        m.Entity<IdempotencyRecord>().HasIndex(x => new { x.ActorId, x.Operation, x.Key }).IsUnique();
        m.Entity<BusinessEvent>().ToTable("BusinessEvents", "pv");
        m.Entity<BusinessEvent>().HasIndex(x => new { x.EventType, x.OccurredAt });
        m.Entity<AcquisitionContext>().ToTable("AcquisitionContexts", "pv");
        m.Entity<AcquisitionContext>().Property(x => x.TokenHash).HasMaxLength(64);
        m.Entity<AcquisitionContext>().HasIndex(x => x.TokenHash).IsUnique();
        m.Entity<SupportTicket>().ToTable("SupportTickets", "pv");
        foreach (var e in m.Model.GetEntityTypes().Where(e => e.GetSchema() == "pv"))
        {
            foreach (var p in e.GetProperties().Where(p => p.ClrType == typeof(DateTime) || p.ClrType == typeof(DateTime?)))
                p.SetValueConverter(new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(), v => DateTime.SpecifyKind(v, DateTimeKind.Utc)));
            foreach (var p in e.GetProperties().Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
                if (p.GetPrecision() is null) { p.SetPrecision(18); p.SetScale(2); }
        }
    }
}
