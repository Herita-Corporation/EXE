using Microsoft.EntityFrameworkCore;

namespace Task.Infrastructure.Premium;

// Premium access itself is authoritative in IAM Service.  These tables only
// describe mission content, groups and reward inventory owned by Task Service.
public sealed class PremiumProvince
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
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

public sealed class PremiumVoucherCode
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
    public string Code { get; set; } = "";
    public string? RedemptionUrl { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public Guid? GroupId { get; set; }
    public DateTime? AssignedAtUtc { get; set; }
    public DateTime? RedeemedAtUtc { get; set; }
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
    public Guid? VoucherCodeId { get; set; }
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
            e.HasIndex(x => x.Code).IsUnique();
        });
        model.Entity<PremiumMissionDefinition>(e =>
        {
            e.ToTable("PremiumMissionDefinitions", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(250); e.Property(x => x.PlaceName).HasMaxLength(250);
            e.Property(x => x.PlaceQuery).HasMaxLength(500); e.Property(x => x.EvidenceType).HasMaxLength(10);
            e.HasIndex(x => new { x.ProvinceId, x.SortOrder }).IsUnique();
            e.HasOne(x => x.Province).WithMany().HasForeignKey(x => x.ProvinceId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PremiumVoucherCode>(e =>
        {
            e.ToTable("PremiumVoucherCodes", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.Scope).HasMaxLength(16); e.Property(x => x.Code).HasMaxLength(256);
            e.Property(x => x.Provider).HasMaxLength(160); e.Property(x => x.Category).HasMaxLength(100);
            e.Property(x => x.Title).HasMaxLength(250); e.Property(x => x.Benefit).HasMaxLength(500);
            e.Property(x => x.RedemptionUrl).HasMaxLength(1000);
            e.HasIndex(x => x.Code).IsUnique();
            e.HasIndex(x => new { x.ProvinceId, x.MissionId, x.Scope, x.AssignedToUserId, x.ExpiresAtUtc });
        });
        model.Entity<PremiumMissionAssignment>(e =>
        {
            e.ToTable("PremiumMissionAssignments", "premium"); e.HasKey(x => x.Id);
            e.Property(x => x.EvidenceUrl).HasMaxLength(1000);
            e.HasIndex(x => new { x.MissionId, x.UserId, x.GroupId }).IsUnique().HasFilter("[GroupId] IS NOT NULL");
            e.HasIndex(x => new { x.MissionId, x.UserId }).IsUnique().HasFilter("[GroupId] IS NULL");
            e.HasOne(x => x.Mission).WithMany().HasForeignKey(x => x.MissionId).OnDelete(DeleteBehavior.Restrict);
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
