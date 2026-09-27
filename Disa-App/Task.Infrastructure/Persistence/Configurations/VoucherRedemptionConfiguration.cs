using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task.Domain.Entities;

namespace Task.Infrastructure.Persistence.Configurations;

public class VoucherRedemptionConfiguration : IEntityTypeConfiguration<VoucherRedemption>
{
    public void Configure(EntityTypeBuilder<VoucherRedemption> builder)
    {
        builder.ToTable("VoucherRedemptions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
               .ValueGeneratedOnAdd();

        builder.Property(x => x.RedeemedAt).HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(x => x.UserId);
    }
}
