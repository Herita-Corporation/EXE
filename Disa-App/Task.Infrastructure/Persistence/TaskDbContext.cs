using Microsoft.EntityFrameworkCore;
using Task.Domain.Entities;
namespace Task.Infrastructure.Persistence
{
    public class TaskDbContext : DbContext
    {
        public TaskDbContext(DbContextOptions<TaskDbContext> options)
            : base(options)
        {
        }
        public DbSet<MissionTemplate> MissionTemplates => Set<MissionTemplate>();

        public DbSet<UserMission> UserMissions => Set<UserMission>();

        public DbSet<MissionSubmission> MissionSubmissions => Set<MissionSubmission>();

        public DbSet<MissionEvidence> MissionEvidences => Set<MissionEvidence>();

        public DbSet<Voucher> Vouchers => Set<Voucher>();

        public DbSet<VoucherRedemption> VoucherRedemptions => Set<VoucherRedemption>();

        public DbSet<PointSpend> PointSpends => Set<PointSpend>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(TaskDbContext).Assembly);
        }
    }
}
