using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task.Domain.Entities;
using Task.Domain.Enums;

namespace Task.Infrastructure.Persistence.Configurations;

public class MissionSubmissionConfiguration : IEntityTypeConfiguration<MissionSubmission>
{
    public void Configure(EntityTypeBuilder<MissionSubmission> builder)
    {
        builder.ToTable("MissionSubmissions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
               .ValueGeneratedOnAdd();

        builder.Property(x => x.VerificationStatus)
               .HasConversion<int>()
               .HasDefaultValue(VerificationStatus.Pending);

        builder.Property(x => x.SubmittedAt)
               .HasDefaultValueSql("GETUTCDATE()");

        builder.HasOne(x => x.UserMission)
               .WithMany(x => x.Submissions)
               .HasForeignKey(x => x.UserMissionId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}