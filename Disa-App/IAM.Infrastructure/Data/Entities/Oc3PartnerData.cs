using Microsoft.EntityFrameworkCore;

namespace IAM.Infrastructure.Data.Entities;

public class PartnerLocation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PartnerId { get; set; }
    public PartnerProfile Partner { get; set; } = null!;
    public Guid SourceRequestId { get; set; }
    public PartnerContentRequest SourceRequest { get; set; } = null!;
    public string TimeZone { get; set; } = "Asia/Ho_Chi_Minh";
    public string ConsentReference { get; set; } = "";
    public Guid? ConfirmedBy { get; set; }
    public int PublishedVersion { get; set; }
    public string Status { get; set; } = "DRAFT";
    public DateTime? FreeStartsAt { get; set; }
    public DateTime? FreeEndsAt { get; set; }
}
public class PartnerLocationMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LocationId { get; set; }
    public PartnerLocation Location { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Status { get; set; } = "INVITED";
    public Guid InvitedBy { get; set; }
    public DateTime? AcceptedAt { get; set; }
}
public class PartnerPublication
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LocationId { get; set; }
    public int Version { get; set; }
    public string PayloadJson { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public int Attempts { get; set; }
}
public class PartnerOwnershipAudit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PartnerId { get; set; }
    public Guid PreviousOwnerId { get; set; }
    public Guid NewOwnerId { get; set; }
    public Guid AdminId { get; set; }
    public string Reason { get; set; } = "";
    public DateTime TransferredAt { get; set; } = DateTime.UtcNow;
}
public class Oc3OwnershipAuditConfiguration : Microsoft.EntityFrameworkCore.IEntityTypeConfiguration<PartnerOwnershipAudit>
{
    public void Configure(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<PartnerOwnershipAudit> b)
    { b.ToTable("PartnerOwnershipAudits"); b.HasKey(x => x.Id); b.Property(x => x.Reason).HasMaxLength(1000); b.HasIndex(x => x.PartnerId); }
}
public class Oc3PartnerConfiguration : Microsoft.EntityFrameworkCore.IEntityTypeConfiguration<PartnerLocation>
{
    public void Configure(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<PartnerLocation> b)
    {
        b.ToTable("PartnerLocations"); b.HasKey(x => x.Id);
        b.HasOne(x => x.Partner).WithMany().HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SourceRequest).WithMany().HasForeignKey(x => x.SourceRequestId).OnDelete(DeleteBehavior.Restrict);
    }
}
public class Oc3MemberConfiguration : Microsoft.EntityFrameworkCore.IEntityTypeConfiguration<PartnerLocationMember>
{
    public void Configure(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<PartnerLocationMember> b)
    {
        b.ToTable("PartnerLocationMembers"); b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.LocationId, x.UserId }).IsUnique();
        b.HasOne(x => x.Location).WithMany().HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
public class Oc3PublicationConfiguration : Microsoft.EntityFrameworkCore.IEntityTypeConfiguration<PartnerPublication>
{
    public void Configure(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<PartnerPublication> b)
    {
        b.ToTable("PartnerPublications"); b.HasKey(x => x.Id); b.HasIndex(x => new { x.LocationId, x.Version }).IsUnique();
    }
}
