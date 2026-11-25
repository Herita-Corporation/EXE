
using IAMService.Premium.Models;
using Microsoft.EntityFrameworkCore;

namespace IAMService.Premium.Data;

public sealed class PremiumDbContext(
    DbContextOptions<PremiumDbContext> options
) : DbContext(options)
{
    // ==========================================
    // 1. DBSETS
    // ==========================================

    public DbSet<PremiumPlan> PremiumPlans
        => Set<PremiumPlan>();

    public DbSet<PremiumPayment> PremiumPayments
        => Set<PremiumPayment>();

    public DbSet<UserPremiumSubscription> UserPremiumSubscriptions
        => Set<UserPremiumSubscription>();

    // NEW: SePay transaction reconciliation
    public DbSet<SePayIncomingTransaction> SePayIncomingTransactions
        => Set<SePayIncomingTransaction>();

    // ==========================================
    // 2. DATABASE CONFIGURATION
    // ==========================================

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // ======================================
        // PREMIUM PLANS
        // ======================================

        b.Entity<PremiumPlan>(e =>
        {
            e.ToTable("PremiumPlans");

            e.HasKey(x => x.Id);

            e.HasIndex(x => x.Code)
                .IsUnique();

            e.Property(x => x.Code)
                .HasMaxLength(30)
                .IsRequired();

            e.Property(x => x.Name)
                .HasMaxLength(120)
                .IsRequired();

            e.Property(x => x.GoogleProductId)
                .HasMaxLength(120);

            e.Property(x => x.AppleProductId)
                .HasMaxLength(120);

            // Existing Premium plans
            e.HasData(
                new PremiumPlan
                {
                    Id = 1,
                    Code = "MONTHLY",
                    Name = "DISA Premium 1 tháng",
                    DurationMonths = 1,
                    PriceVnd = 29000,
                    GoogleProductId = "disa_premium_1m",
                    AppleProductId = "disa_premium_1m"
                },
                new PremiumPlan
                {
                    Id = 2,
                    Code = "HALF_YEAR",
                    Name = "DISA Premium 6 tháng",
                    DurationMonths = 6,
                    PriceVnd = 79000,
                    GoogleProductId = "disa_premium_6m",
                    AppleProductId = "disa_premium_6m"
                },
                new PremiumPlan
                {
                    Id = 3,
                    Code = "YEARLY",
                    Name = "DISA Premium 12 tháng",
                    DurationMonths = 12,
                    PriceVnd = 129000,
                    GoogleProductId = "disa_premium_12m",
                    AppleProductId = "disa_premium_12m"
                }
            );
        });

        // ======================================
        // PREMIUM PAYMENTS
        // ======================================

        b.Entity<PremiumPayment>(e =>
        {
            e.ToTable("PremiumPayments");

            e.HasKey(x => x.Id);

            e.HasIndex(x => x.OrderCode)
                .IsUnique();

            // Prevent duplicate provider transactions.
            e.HasIndex(x => new
            {
                x.Provider,
                x.ProviderTransactionId
            })
            .IsUnique()
            .HasFilter("[ProviderTransactionId] IS NOT NULL");

            // Prevent duplicate store purchase tokens.
            e.HasIndex(x => new
            {
                x.Provider,
                x.StoreTokenHash
            })
            .IsUnique()
            .HasFilter("[StoreTokenHash] IS NOT NULL");

            e.Property(x => x.OrderCode)
                .HasMaxLength(50)
                .IsRequired();

            e.Property(x => x.Provider)
                .HasMaxLength(30)
                .IsRequired();

            e.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            e.Property(x => x.ProviderTransactionId)
                .HasMaxLength(200);

            e.Property(x => x.StoreTokenHash)
                .HasMaxLength(64);

            e.HasOne(x => x.Plan)
                .WithMany()
                .HasForeignKey(x => x.PlanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ======================================
        // USER PREMIUM SUBSCRIPTIONS
        // ======================================

        b.Entity<UserPremiumSubscription>(e =>
        {
            e.ToTable("UserPremiumSubscriptions");

            e.HasKey(x => x.UserId);

            e.Property(x => x.UserId)
                .ValueGeneratedNever();

            e.Property(x => x.Status)
                .HasMaxLength(30);

            e.HasOne<PremiumPlan>()
                .WithMany()
                .HasForeignKey(x => x.PlanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ======================================
        // NEW: SEPAY INCOMING TRANSACTIONS
        // ======================================

        b.Entity<SePayIncomingTransaction>(e =>
        {
            e.ToTable("SePayIncomingTransactions");

            e.HasKey(x => x.Id);

            e.Property(x => x.Environment)
                .HasMaxLength(10)
                .IsRequired();

            e.Property(x => x.SePayTransactionId)
                .HasMaxLength(100)
                .IsRequired();

            // A transaction ID can only be recorded
            // once per SePay environment.
            e.HasIndex(x => new
            {
                x.Environment,
                x.SePayTransactionId
            })
            .IsUnique();

            e.Property(x => x.BankAccount)
                .HasMaxLength(50)
                .IsRequired();

            e.Property(x => x.TransferContent)
                .HasMaxLength(1000)
                .IsRequired();

            e.Property(x => x.OrderCode)
                .HasMaxLength(100);

            e.Property(x => x.AmountVnd)
                .IsRequired();

            e.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            e.Property(x => x.Reason)
                .HasMaxLength(100);

            e.Property(x => x.PayloadJson)
                .HasColumnType("nvarchar(max)")
                .IsRequired();

            e.Property(x => x.ReceivedAtUtc)
                .IsRequired();

            e.HasIndex(x => x.Status);

            e.HasIndex(x => x.PaymentId);

            e.HasIndex(x => x.ReceivedAtUtc);
        });
    }
}
