using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.Premium;

public static class PremiumCatalogSeeder
{
    private static readonly string[] Provinces =
    [
        "An Giang", "Bắc Ninh", "Cà Mau", "Cao Bằng", "Cần Thơ", "Đà Nẵng", "Đắk Lắk", "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Nội", "Hà Tĩnh", "Hải Phòng", "Huế", "Hưng Yên", "Khánh Hòa", "Lai Châu", "Lạng Sơn", "Lào Cai", "Lâm Đồng", "Nghệ An", "Ninh Bình", "Phú Thọ", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sơn La", "Tây Ninh", "Thái Nguyên", "Thanh Hóa", "Tuyên Quang", "Vĩnh Long", "TP. Hồ Chí Minh"
    ];

    public static async System.Threading.Tasks.Task SeedAsync(TaskDbContext db)
    {
        if (await db.Set<PremiumProvince>().AnyAsync()) return;
        for (var provinceIndex = 0; provinceIndex < Provinces.Length; provinceIndex++)
        {
            var province = new PremiumProvince { Code = $"VN-{provinceIndex + 1:00}", Name = Provinces[provinceIndex] };
            db.Add(province);
            for (var missionIndex = 1; missionIndex <= 8; missionIndex++)
            {
                var video = missionIndex is 4 or 8;
                db.Add(new PremiumMissionDefinition
                {
                    Province = province,
                    SortOrder = missionIndex,
                    EvidenceType = video ? "VIDEO" : "PHOTO",
                    Title = $"Khám phá {Provinces[provinceIndex]} · nhiệm vụ {missionIndex}",
                    Instruction = video ? "Quay video tại điểm đến theo hướng dẫn của DISA." : "Chụp ảnh tại điểm đến theo hướng dẫn của DISA.",
                    PlaceName = Provinces[provinceIndex],
                    PlaceQuery = Provinces[provinceIndex]
                });
            }
        }
        await db.SaveChangesAsync();
    }
}
