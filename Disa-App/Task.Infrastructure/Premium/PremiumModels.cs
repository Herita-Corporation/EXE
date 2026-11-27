using Microsoft.EntityFrameworkCore;

namespace Task.Infrastructure.Premium;

// Premium access itself is authoritative in IAM Service. These tables only
// describe mission content, groups and public partner offers owned by Task Service.
public sealed class PremiumProvince
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    // Kept under the legacy table name for backward compatibility. A row can
    // now represent either one of the 34 administrative provinces or a
    // featured travel destination within one of them.
    public string AreaType { get; set; } = "PROVINCE";
    public Guid? ParentProvinceId { get; set; }
    public string Aliases { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public sealed class PremiumMissionDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProvinceId { get; set; }
    public PremiumProvince Province { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Instruction { get; set; } = "";
    public string PlaceName { get; set; } = "";
    public string PlaceQuery { get; set; } = "";
    public string EvidenceType { get; set; } = "PHOTO";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

// Public partner benefits are reusable HTTPS links, so accepting a mission
// never depends on a private voucher code being available.
public sealed class PremiumPublicOffer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProvinceId { get; set; }
    public Guid? MissionId { get; set; }
    public string Scope { get; set; } = "SPECIAL";
    public string Provider { get; set; } = "";
    public string Category { get; set; } = "";
    public string Title { get; set; } = "";
    public string Benefit { get; set; } = "";
    public string Terms { get; set; } = "";
    public string PublicUrl { get; set; } = "";
    public DateTime? StartsAtUtc { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class PremiumMissionAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MissionId { get; set; }
    public PremiumMissionDefinition Mission { get; set; } = null!;
    public Guid UserId { get; set; }
    public Guid? GroupId { get; set; }
    public DateTime AcceptedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
    public string? EvidenceUrl { get; set; }
    public int BonusPoints { get; set; }
}

// A template is a public demo offer. It deliberately contains no coupon code,
// inventory or partner credential. Completing a mission creates a distinct
// user voucher record referring to one of these templates.
public sealed class PremiumVirtualVoucherTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string PartnerKey { get; set; } = "";
    public string Provider { get; set; } = "";
    public string Category { get; set; } = "";
    public string Title { get; set; } = "";
    public string Benefit { get; set; } = "";
    public string Terms { get; set; } = "";
    public string PublicUrl { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public sealed class PremiumVirtualVoucher
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AssignmentId { get; set; }
    public PremiumMissionAssignment Assignment { get; set; } = null!;
    public Guid UserId { get; set; }
    public Guid TemplateId { get; set; }
    public PremiumVirtualVoucherTemplate Template { get; set; } = null!;
    public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class PremiumGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProvinceId { get; set; }
    public PremiumProvince Province { get; set; } = null!;
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public ICollection<PremiumGroupMember> Members { get; set; } = new List<PremiumGroupMember>();
}

public sealed class PremiumGroupMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public PremiumGroup Group { get; set; } = null!;
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = "";
}

public static class PremiumTaskModel
{
    public static void Configure(ModelBuilder model)
    {
        model.Entity<PremiumProvince>(e =>
        {
            e.ToTable("PremiumProvinces", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.Code).HasMaxLength(32); e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.AreaType).HasMaxLength(16);
            e.Property(x => x.Aliases).HasMaxLength(2000);
            e.HasIndex(x => x.Code).IsUnique();
            e.HasIndex(x => new { x.AreaType, x.IsActive, x.Name });
        });
        model.Entity<PremiumMissionDefinition>(e =>
        {
            e.ToTable("PremiumMissionDefinitions", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(250); e.Property(x => x.PlaceName).HasMaxLength(250);
            e.Property(x => x.PlaceQuery).HasMaxLength(500); e.Property(x => x.EvidenceType).HasMaxLength(10);
            e.HasIndex(x => new { x.ProvinceId, x.SortOrder }).IsUnique();
            e.HasOne(x => x.Province).WithMany().HasForeignKey(x => x.ProvinceId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PremiumPublicOffer>(e =>
        {
            e.ToTable("PremiumPublicOffers", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.Scope).HasMaxLength(16); e.Property(x => x.Provider).HasMaxLength(160);
            e.Property(x => x.Category).HasMaxLength(100); e.Property(x => x.Title).HasMaxLength(250);
            e.Property(x => x.Benefit).HasMaxLength(500); e.Property(x => x.PublicUrl).HasMaxLength(1000);
            e.HasIndex(x => new { x.ProvinceId, x.MissionId, x.Scope, x.IsActive });
        });
        model.Entity<PremiumMissionAssignment>(e =>
        {
            e.ToTable("PremiumMissionAssignments", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.EvidenceUrl).HasMaxLength(1000);
            e.HasIndex(x => new { x.MissionId, x.UserId, x.GroupId }).IsUnique().HasFilter("[GroupId] IS NOT NULL");
            e.HasIndex(x => new { x.MissionId, x.UserId }).IsUnique().HasFilter("[GroupId] IS NULL");
            e.HasOne(x => x.Mission).WithMany().HasForeignKey(x => x.MissionId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PremiumVirtualVoucherTemplate>(e =>
        {
            e.ToTable("PremiumVirtualVoucherTemplates", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.PartnerKey).HasMaxLength(80); e.HasIndex(x => x.PartnerKey).IsUnique();
            e.Property(x => x.Provider).HasMaxLength(160); e.Property(x => x.Category).HasMaxLength(100);
            e.Property(x => x.Title).HasMaxLength(250); e.Property(x => x.Benefit).HasMaxLength(500);
            e.Property(x => x.PublicUrl).HasMaxLength(1000);
        });
        model.Entity<PremiumVirtualVoucher>(e =>
        {
            e.ToTable("PremiumVirtualVouchers", "premium"); e.HasKey(x => x.Id);
            e.HasIndex(x => x.AssignmentId).IsUnique();
            e.HasIndex(x => new { x.UserId, x.IssuedAtUtc });
            e.HasOne(x => x.Assignment).WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Template).WithMany().HasForeignKey(x => x.TemplateId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PremiumGroup>(e =>
        {
            e.ToTable("PremiumGroups", "premium"); e.HasKey(x => x.Id);
            e.HasOne(x => x.Province).WithMany().HasForeignKey(x => x.ProvinceId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PremiumGroupMember>(e =>
        {
            e.ToTable("PremiumGroupMembers", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.DisplayName).HasMaxLength(120);
            e.HasIndex(x => new { x.GroupId, x.UserId }).IsUnique();
            e.HasOne(x => x.Group).WithMany(x => x.Members).HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
