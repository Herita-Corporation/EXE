using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Task.Domain.Entities;

namespace Task.Infrastructure.Persistence;

/// <summary>
/// Ships the app's demo voucher catalog with the service: on startup, any demo
/// voucher whose Code isn't in the database yet is inserted. Idempotent, so it
/// runs on every boot without duplicating; vouchers already in the table
/// (including ones a user has redeemed) are never touched.
/// Same data as DATABASE/seed_demo_vouchers.sql.
/// </summary>
public static class DemoVoucherSeeder
{
    // Wikimedia Commons photos — the app sends the User-Agent Wikimedia
    // requires (Front-End src/data/regionImages.ts#remoteImage).
    private const string Wiki = "https://thumb.wikimedia.org/wikipedia/commons/thumb/";

    private static readonly (string Category, string Title, string Description, string ImageUrl,
        int PointsCost, string DiscountLabel, string Location, string Code, string[] Terms)[] Demo =
    {
        ("Dining", "Highland Coffee – Mua 1 tặng 1",
            "Mua một đồ uống bất kỳ, tặng thêm một đồ uống cùng loại tại các cửa hàng Highland Coffee tham gia.",
            Wiki + "0/09/B%E1%BB%9D_%C4%91%C3%B4ng_c%E1%BA%A7u_R%E1%BB%93ng.jpg/960px-B%E1%BB%9D_%C4%91%C3%B4ng_c%E1%BA%A7u_R%E1%BB%93ng.jpg",
            150, "1 TẶNG 1", "Đà Nẵng", "DISA-HLC-1T1",
            new[] { "Áp dụng cho đồ uống size M", "Không áp dụng cùng khuyến mãi khác", "Mỗi khách dùng 1 lần" }),

        ("Hotels", "Giảm 15% phòng nghỉ Đà Lạt",
            "Ưu đãi 15% giá phòng tại các khách sạn đối tác ở trung tâm Đà Lạt, gần hồ Xuân Hương.",
            Wiki + "e/e2/Da_Lat_-_Viet_Nam.jpg/960px-Da_Lat_-_Viet_Nam.jpg",
            600, "-15%", "Đà Lạt, Lâm Đồng", "DISA-DL-HOTEL15",
            new[] { "Lưu trú tối thiểu 2 đêm", "Đặt trước ít nhất 3 ngày", "Không áp dụng dịp Lễ, Tết" }),

        ("Travel", "Phòng chờ hạng thương gia sân bay",
            "Một lượt sử dụng phòng chờ hạng thương gia miễn phí tại nhà ga quốc nội.",
            Wiki + "b/bc/Phu_Quoc%2C_Viet_Nam.jpg/960px-Phu_Quoc%2C_Viet_Nam.jpg",
            900, "MIỄN PHÍ", "Sân bay Phú Quốc", "DISA-LOUNGE-FREE",
            new[] { "Xuất trình thẻ lên máy bay cùng ngày", "Sử dụng tối đa 3 giờ" }),

        ("Experience", "Du thuyền ngắm vịnh Hạ Long",
            "Giảm 20% tour du thuyền 4 giờ trên vịnh Hạ Long, bao gồm chèo kayak tại hang Luồn.",
            Wiki + "4/42/Ha_Long_2019_taken_by_DJI_FC220.jpg/960px-Ha_Long_2019_taken_by_DJI_FC220.jpg",
            800, "-20%", "Vịnh Hạ Long, Quảng Ninh", "DISA-HALONG-20",
            new[] { "Đặt chỗ trước 24 giờ", "Áp dụng cho tối đa 4 khách" }),

        ("Wellness", "Spa thảo dược Nha Trang",
            "Giảm 25% gói massage thảo dược 60 phút tại các spa đối tác ven biển Nha Trang.",
            Wiki + "9/9c/Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg/960px-Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg",
            450, "-25%", "Nha Trang, Khánh Hòa", "DISA-NT-SPA25",
            new[] { "Đặt lịch trước qua hotline của spa", "Không quy đổi thành tiền mặt" }),

        ("Transport", "Xe đưa đón tham quan Huế",
            "Giảm 30% xe riêng tham quan Đại Nội và lăng tẩm Huế trong ngày.",
            Wiki + "4/40/Th%C3%A0nh_ph%E1%BB%91_Hu%E1%BA%BF_nh%C3%ACn_t%E1%BB%AB_tr%C3%AAn_cao_%282%29.jpg/960px-Th%C3%A0nh_ph%E1%BB%91_Hu%E1%BA%BF_nh%C3%ACn_t%E1%BB%AB_tr%C3%AAn_cao_%282%29.jpg",
            350, "-30%", "Thành phố Huế", "DISA-HUE-CAR30",
            new[] { "Xe 4–7 chỗ, tối đa 8 giờ", "Đặt trước ít nhất 1 ngày" }),
    };

    /// <summary>Inserts the demo vouchers missing from the table; returns how many.</summary>
    public static async System.Threading.Tasks.Task<int> SeedAsync(TaskDbContext db)
    {
        var existingCodes = await db.Vouchers.Select(v => v.Code).ToListAsync();
        var missing = Demo.Where(d => !existingCodes.Contains(d.Code)).ToList();
        if (missing.Count == 0) return 0;

        // Long enough that a demo never "expires" mid-semester.
        var expiresAt = DateTime.UtcNow.AddYears(1);
        foreach (var d in missing)
        {
            db.Vouchers.Add(new Voucher
            {
                Id = Guid.NewGuid(),
                Category = d.Category,
                Title = d.Title,
                Description = d.Description,
                ImageUrl = d.ImageUrl,
                PointsCost = d.PointsCost,
                DiscountLabel = d.DiscountLabel,
                Location = d.Location,
                ExpiresAt = expiresAt,
                Code = d.Code,
                TermsJson = JsonSerializer.Serialize(d.Terms),
                IsActive = true,
            });
        }

        await db.SaveChangesAsync();
        return missing.Count;
    }
}
