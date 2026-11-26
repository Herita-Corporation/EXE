using Microsoft.EntityFrameworkCore;
using Task.Infrastructure.Persistence;

namespace Task.Infrastructure.Premium;

/// <summary>Idempotent Premium catalog. The legacy province table also stores destination areas.</summary>
public static class PremiumCatalogSeeder
{
    private sealed record Area(string Code, string Name, string Type, string? ParentCode, params string[] Aliases);
    private sealed record VoucherTemplate(string PartnerKey, string Provider, string Category, string Title, string Benefit, string Terms, string PublicUrl);

    private static readonly Area[] Areas =
    [
        new("VN-01", "An Giang", "PROVINCE", null, "Kiên Giang", "Phú Quốc", "Hà Tiên"), new("VN-02", "Bắc Ninh", "PROVINCE", null, "Bắc Giang"),
        new("VN-03", "Cà Mau", "PROVINCE", null, "Bạc Liêu", "Sóc Trăng"), new("VN-04", "Cao Bằng", "PROVINCE", null),
        new("VN-05", "Cần Thơ", "PROVINCE", null, "Hậu Giang"), new("VN-06", "Đà Nẵng", "PROVINCE", null, "Quảng Nam", "Hội An"),
        new("VN-07", "Đắk Lắk", "PROVINCE", null, "Phú Yên"), new("VN-08", "Điện Biên", "PROVINCE", null),
        new("VN-09", "Đồng Nai", "PROVINCE", null, "Bình Phước"), new("VN-10", "Đồng Tháp", "PROVINCE", null, "Tiền Giang", "Mỹ Tho"),
        new("VN-11", "Gia Lai", "PROVINCE", null, "Bình Định", "Quy Nhơn"), new("VN-12", "Hà Nội", "PROVINCE", null),
        new("VN-13", "Hà Tĩnh", "PROVINCE", null), new("VN-14", "Hải Phòng", "PROVINCE", null, "Hải Dương", "Cát Bà"),
        new("VN-15", "Huế", "PROVINCE", null, "Thừa Thiên Huế"), new("VN-16", "Hưng Yên", "PROVINCE", null, "Thái Bình"),
        new("VN-17", "Khánh Hòa", "PROVINCE", null, "Ninh Thuận", "Nha Trang"), new("VN-18", "Lai Châu", "PROVINCE", null),
        new("VN-19", "Lạng Sơn", "PROVINCE", null), new("VN-20", "Lào Cai", "PROVINCE", null, "Yên Bái", "Sa Pa", "Sapa"),
        new("VN-21", "Lâm Đồng", "PROVINCE", null, "Bình Thuận", "Đắk Nông", "Đà Lạt"), new("VN-22", "Nghệ An", "PROVINCE", null),
        new("VN-23", "Ninh Bình", "PROVINCE", null, "Nam Định", "Hà Nam"), new("VN-24", "Phú Thọ", "PROVINCE", null, "Hòa Bình", "Vĩnh Phúc"),
        new("VN-25", "Quảng Ngãi", "PROVINCE", null, "Kon Tum"), new("VN-26", "Quảng Ninh", "PROVINCE", null, "Hạ Long"),
        new("VN-27", "Quảng Trị", "PROVINCE", null, "Quảng Bình", "Phong Nha"), new("VN-28", "Sơn La", "PROVINCE", null, "Mộc Châu"),
        new("VN-29", "Tây Ninh", "PROVINCE", null, "Long An"), new("VN-30", "Thái Nguyên", "PROVINCE", null, "Bắc Kạn"),
        new("VN-31", "Thanh Hóa", "PROVINCE", null), new("VN-32", "Tuyên Quang", "PROVINCE", null, "Hà Giang", "Đồng Văn"),
        new("VN-33", "Vĩnh Long", "PROVINCE", null, "Bến Tre", "Trà Vinh"), new("VN-34", "TP. Hồ Chí Minh", "PROVINCE", null, "Hồ Chí Minh", "TPHCM", "Sài Gòn", "Bà Rịa - Vũng Tàu"),
        new("DEST-PHU-QUOC", "Phú Quốc", "DESTINATION", "VN-01", "Phú Quốc, An Giang", "Kiên Giang"), new("DEST-VUNG-TAU", "Vũng Tàu", "DESTINATION", "VN-34", "Bà Rịa - Vũng Tàu", "Bà Rịa", "Vung Tau"),
        new("DEST-DA-LAT", "Đà Lạt", "DESTINATION", "VN-21", "Lâm Đồng", "Da Lat"), new("DEST-NHA-TRANG", "Nha Trang", "DESTINATION", "VN-17", "Khánh Hòa"),
        new("DEST-HA-LONG", "Hạ Long", "DESTINATION", "VN-26", "Quảng Ninh"), new("DEST-SA-PA", "Sa Pa", "DESTINATION", "VN-20", "Lào Cai", "Sapa"),
        new("DEST-HOI-AN", "Hội An", "DESTINATION", "VN-06", "Đà Nẵng", "Quảng Nam"), new("DEST-MUI-NE", "Mũi Né", "DESTINATION", "VN-21", "Bình Thuận", "Phan Thiết"),
        new("DEST-QUY-NHON", "Quy Nhơn", "DESTINATION", "VN-11", "Bình Định", "Gia Lai"), new("DEST-MOC-CHAU", "Mộc Châu", "DESTINATION", "VN-28", "Sơn La"),
        new("DEST-PHONG-NHA", "Phong Nha - Kẻ Bàng", "DESTINATION", "VN-27", "Quảng Bình", "Phong Nha"), new("DEST-CAT-BA", "Cát Bà", "DESTINATION", "VN-14", "Hải Phòng")
    ];

    // Public demo links only: no code, inventory or partner credential is kept.
    private static readonly VoucherTemplate[] VoucherTemplates =
    [
        new("emerald-phu-quoc", "Emerald Boutique Hotel Phú Quốc", "Hotels", "Ưu đãi demo Emerald Boutique Hotel", "Giảm 10% khi đặt trên Booking.com bằng điện thoại", "Liên kết công khai minh họa, không phải mã giảm giá hoặc xác nhận đặt chỗ.", "https://www.booking.com/hotel/vn/emerald-boutique-phu-quoc.html"),
        new("lat-valley-villa", "Lat Valley Villa", "Hotels", "Ưu đãi demo Lat Valley Villa", "Giảm 10% và tặng buffet sáng", "Liên kết công khai minh họa, không phải mã giảm giá hoặc xác nhận đặt chỗ.", "https://www.google.com/maps/search/?api=1&query=Lat+Valley+Villa+Da+Lat"),
        new("sus-house-coffee", "Su's House Coffee", "Dining", "Ưu đãi demo Su's House Coffee", "Giảm 10% trên tổng hóa đơn", "Liên kết công khai minh họa, không phải mã giảm giá hoặc xác nhận đặt chỗ.", "https://www.google.com/maps/search/?api=1&query=Sus+House+Coffee+Ho+Chi+Minh")
    ];

    public static async global::System.Threading.Tasks.Task SeedAsync(TaskDbContext db)
    {
        var existing = await db.Set<PremiumProvince>().ToDictionaryAsync(x => x.Code);
        foreach (var area in Areas)
        {
            if (!existing.TryGetValue(area.Code, out var entity))
            {
                entity = new PremiumProvince { Code = area.Code };
                db.Add(entity); existing.Add(area.Code, entity);
            }
            entity.Name = area.Name; entity.AreaType = area.Type;
            entity.Aliases = string.Join('|', area.Aliases.Prepend(area.Name).Distinct(StringComparer.OrdinalIgnoreCase));
            entity.IsActive = true;
        }
        foreach (var area in Areas) existing[area.Code].ParentProvinceId = area.ParentCode is null ? null : existing[area.ParentCode].Id;
        await db.SaveChangesAsync();

        foreach (var area in Areas)
        {
            var entity = existing[area.Code];
            var definitions = await db.Set<PremiumMissionDefinition>().Where(x => x.ProvinceId == entity.Id).OrderBy(x => x.SortOrder).ToListAsync();
            for (var number = 1; number <= 10; number++)
            {
                var mission = definitions.FirstOrDefault(x => x.SortOrder == number);
                if (mission is null) { mission = new PremiumMissionDefinition { ProvinceId = entity.Id, SortOrder = number }; db.Add(mission); }
                ApplyMission(mission, area.Name, number);
            }
            foreach (var extra in definitions.Where(x => x.SortOrder > 10)) extra.IsActive = false;
        }

        var templates = await db.Set<PremiumVirtualVoucherTemplate>().ToDictionaryAsync(x => x.PartnerKey);
        foreach (var template in VoucherTemplates)
        {
            if (!templates.TryGetValue(template.PartnerKey, out var entity)) { entity = new PremiumVirtualVoucherTemplate { PartnerKey = template.PartnerKey }; db.Add(entity); }
            entity.Provider = template.Provider; entity.Category = template.Category; entity.Title = template.Title; entity.Benefit = template.Benefit;
            entity.Terms = template.Terms; entity.PublicUrl = template.PublicUrl; entity.IsActive = true;
        }
        await db.SaveChangesAsync();
    }

    private static void ApplyMission(PremiumMissionDefinition mission, string areaName, int number)
    {
        var video = number is 4 or 8;
        mission.Title = $"Khám phá {areaName} · nhiệm vụ đặc biệt {number}";
        mission.Instruction = video ? $"Quay video tại một điểm nổi bật ở {areaName} theo hướng dẫn của DISA." : $"Chụp ảnh tại một điểm nổi bật ở {areaName} theo hướng dẫn của DISA.";
        mission.PlaceName = areaName; mission.PlaceQuery = areaName; mission.EvidenceType = video ? "VIDEO" : "PHOTO"; mission.IsActive = true;
    }
}
