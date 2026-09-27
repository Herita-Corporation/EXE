using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task.Domain.Entities;

namespace Task.Infrastructure.Persistence.Configurations;

public class MissionEvidenceConfiguration : IEntityTypeConfiguration<MissionEvidence>
{
    public void Configure(EntityTypeBuilder<MissionEvidence> builder)
    {
        builder.ToTable("MissionEvidences");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
               .ValueGeneratedOnAdd();

        builder.Property(x => x.MediaUrl)
               .HasMaxLength(500)
               .IsRequired();


        builder.HasOne(x => x.Submission)
               .WithMany(x => x.Evidences)
               .HasForeignKey(x => x.SubmissionId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}