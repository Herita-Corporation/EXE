using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Task.Domain.Entities;

namespace Task.Infrastructure.Persistence.Configurations;

public class VoucherConfiguration : IEntityTypeConfiguration<Voucher>
{
    public void Configure(EntityTypeBuilder<Voucher> builder)
    {
        builder.ToTable("Vouchers");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
               .ValueGeneratedOnAdd();

        builder.Property(x => x.Category).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasColumnType("nvarchar(max)");
        builder.Property(x => x.ImageUrl).HasMaxLength(500);
        builder.Property(x => x.DiscountLabel).HasMaxLength(50);
        builder.Property(x => x.Location).HasMaxLength(200);
        builder.Property(x => x.Code).HasMaxLength(100).IsRequired();
        builder.Property(x => x.TermsJson).HasColumnType("nvarchar(max)");

        builder.Property(x => x.IsActive).HasDefaultValue(true);
        builder.Property(x => x.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

        builder.HasMany(x => x.Redemptions)
               .WithOne(x => x.Voucher)
               .HasForeignKey(x => x.VoucherId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
