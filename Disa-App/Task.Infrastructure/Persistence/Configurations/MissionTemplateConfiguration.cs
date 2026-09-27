using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task.Domain.Entities;

namespace Task.Infrastructure.Persistence.Configurations;

public class MissionTemplateConfiguration : IEntityTypeConfiguration<MissionTemplate>
{
    public void Configure(EntityTypeBuilder<MissionTemplate> builder)
    {
        builder.ToTable("MissionTemplates");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
               .ValueGeneratedOnAdd();

        builder.Property(x => x.Name)
               .HasMaxLength(200)
               .IsRequired();

        builder.Property(x => x.Description)
               .HasColumnType("nvarchar(max)");

        builder.Property(x => x.RewardXP)
               .HasDefaultValue(0);

        builder.Property(x => x.RewardCoins)
               .HasDefaultValue(0);

        builder.Property(x => x.RequiresPhoto)
               .HasDefaultValue(false);

        builder.Property(x => x.RequiresVideo)
               .HasDefaultValue(false);

        builder.Property(x => x.RequiresLocation)
               .HasDefaultValue(false);

        builder.Property(x => x.IsActive)
               .HasDefaultValue(true);

        builder.HasMany(x => x.UserMissions)
               .WithOne(x => x.Template)
               .HasForeignKey(x => x.TemplateId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}