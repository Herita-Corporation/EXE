using Microsoft.EntityFrameworkCore;
using System.Security;

namespace IAM.Infrastructure.Data.Entities;

public partial class IAMDbContext : DbContext
{
    public IAMDbContext()
    {
    }

    public IAMDbContext(DbContextOptions<IAMDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<User> Users { get; set; }
    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<RefreshToken> RefreshTokens { get; set; }

    public virtual DbSet<Permission> Permissions { get; set; }

    public virtual DbSet<VerificationCode> VerificationCodes { get; set; }

    public virtual DbSet<Event> Events { get; set; }



    public virtual DbSet<PartnerProfile> PartnerProfiles { get; set; } = null!;
    public virtual DbSet<PartnerContentRequest> PartnerContentRequests { get; set; } = null!;
    public virtual DbSet<PartnerRequestImage> PartnerRequestImages { get; set; } = null!;
    public virtual DbSet<PartnerInvoice> PartnerInvoices { get; set; } = null!;
    public virtual DbSet<PartnerReviewAudit> PartnerReviewAudits { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<PartnerProfile>(e => {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.BusinessName).HasMaxLength(250).IsRequired();
            e.Property(x => x.Email).HasMaxLength(255);
        });
        modelBuilder.Entity<PartnerContentRequest>(e => {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Partner).WithMany(x => x.Requests).HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Title).HasMaxLength(250).IsRequired();
            e.Property(x => x.Price).HasPrecision(18,2);
            e.Property(x => x.Latitude).HasPrecision(10,7);
            e.Property(x => x.Longitude).HasPrecision(10,7);
        });
        modelBuilder.Entity<PartnerRequestImage>(e => {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Request).WithMany(x => x.Images).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<PartnerInvoice>(e => {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.InvoiceNumber).IsUnique();
            e.Property(x => x.Amount).HasPrecision(18,2);
            e.HasOne(x => x.Partner).WithMany().HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<PartnerReviewAudit>(e => {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Request).WithMany().HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Restrict);
        });


        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newid())");

            entity.Property(e => e.Username)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.Email)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(e => e.PhoneNumber)
                .HasMaxLength(20);

            entity.Property(e => e.AvatarUrl)
                .HasMaxLength(500);

            entity.Property(e => e.PushToken)
                .HasMaxLength(200);

            entity.Property(e => e.IsPhoneVerified)
                .HasDefaultValue(false);

            entity.Property(e => e.IsEmailVerified)
                .HasDefaultValue(false);

            entity.Property(e => e.IsActive)
                .HasDefaultValue(true);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())");

            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.Username).IsUnique();

            entity.Property(e => e.GoogleId)
                .HasMaxLength(255);

            entity.HasIndex(e => e.GoogleId)
                .IsUnique()
                .HasFilter("[GoogleId] IS NOT NULL");

            entity.HasMany(u => u.Roles)
                .WithMany(r => r.Users)
                .UsingEntity<Dictionary<string, object>>(
                    "UserRoles",
                    j => j.HasOne<Role>()
                        .WithMany()
                        .HasForeignKey("RoleId")
                        .OnDelete(DeleteBehavior.Cascade),
                    j => j.HasOne<User>()
                        .WithMany()
                        .HasForeignKey("UserId")
                        .OnDelete(DeleteBehavior.Cascade),
                    j =>
                    {
                        j.HasKey("UserId", "RoleId");
                        j.ToTable("UserRoles");
                    });
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newid())");

            entity.Property(e => e.Name)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(e => e.Description)
                .HasMaxLength(255);

            entity.HasIndex(e => e.Name).IsUnique();

            entity.HasMany(r => r.Permissions)
                .WithMany(p => p.Roles)
                .UsingEntity<Dictionary<string, object>>(
                    "RolePermissions",
                    j => j.HasOne<Permission>()
                        .WithMany()
                        .HasForeignKey("PermissionId")
                        .OnDelete(DeleteBehavior.Cascade),
                    j => j.HasOne<Role>()
                        .WithMany()
                        .HasForeignKey("RoleId")
                        .OnDelete(DeleteBehavior.Cascade),
                    j =>
                    {
                        j.HasKey("RoleId", "PermissionId");
                        j.ToTable("RolePermissions");
                    });
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newid())");

            entity.Property(e => e.Code)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.Description)
                .HasMaxLength(255);

            entity.HasIndex(e => e.Code).IsUnique();
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newid())");

            entity.Property(e => e.Token)
                .IsRequired();

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())");

            entity.HasOne(rt => rt.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(rt => rt.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.UserId);
        });

        modelBuilder.Entity<VerificationCode>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newid())");

            entity.Property(e => e.Type)
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(e => e.Code)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.Target)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())");

            entity.HasOne(vc => vc.User)
                .WithMany()
                .HasForeignKey(vc => vc.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UserId, e.Type });
        });

        modelBuilder.Entity<Event>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasDefaultValueSql("(newid())");

            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(e => e.Description)
                .HasMaxLength(2000)
                .IsRequired();

            entity.Property(e => e.Tag)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.City)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.CoverImageUrl)
                .HasMaxLength(500);

            entity.Property(e => e.IsActive)
                .HasDefaultValue(true);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())");

            entity.HasIndex(e => e.City);
        });
    }
}