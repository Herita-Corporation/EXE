using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task.Domain.Entities;

namespace Task.Infrastructure.Persistence.Configurations;

public class PointSpendConfiguration : IEntityTypeConfiguration<PointSpend>
{
    public void Configure(EntityTypeBuilder<PointSpend> builder)
    {
        builder.ToTable("PointSpends");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
               .ValueGeneratedOnAdd();

        builder.Property(x => x.Reason).HasMaxLength(255);
        builder.Property(x => x.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(x => x.UserId);
    }
}
