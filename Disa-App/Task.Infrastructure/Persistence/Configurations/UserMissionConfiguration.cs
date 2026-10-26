using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task.Domain.Entities;
using Task.Domain.Enums;

namespace Task.Infrastructure.Persistence.Configurations;

public class UserMissionConfiguration : IEntityTypeConfiguration<UserMission>
{
    public void Configure(EntityTypeBuilder<UserMission> builder)
    {
        builder.ToTable("UserMissions");

        // Primary Key
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
               .ValueGeneratedOnAdd();

        // Properties
        builder.Property(x => x.Title)
               .HasMaxLength(255)
               .IsRequired();

        builder.Property(x => x.Status)
               .HasConversion<int>()
               .HasDefaultValue(MissionStatus.Assigned);

        builder.Property(x => x.StartAt)
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(x => x.RewardXP)
               .HasDefaultValue(0);

        builder.Property(x => x.RewardCoins)
               .HasDefaultValue(0);

        // Lookup index. Semantic uniqueness by user + place title + mission
        // type spans the related template row and is enforced transactionally.
        builder.HasIndex(x => new { x.UserId, x.TripId, x.PlaceId, x.TemplateId })
               .IsUnique(false);

        // Relationship: UserMission -> MissionTemplate
        builder.HasOne(x => x.Template)
               .WithMany(x => x.UserMissions)
               .HasForeignKey(x => x.TemplateId)
               .OnDelete(DeleteBehavior.Restrict);

        // Relationship: UserMission -> MissionSubmission
        builder.HasMany(x => x.Submissions)
               .WithOne(x => x.UserMission)
               .HasForeignKey(x => x.UserMissionId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
