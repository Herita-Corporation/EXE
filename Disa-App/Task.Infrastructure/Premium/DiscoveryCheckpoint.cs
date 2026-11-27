namespace Task.Infrastructure.Premium;

// Coordinates refer to accessible checkpoints, never the middle of a lake.
// Times are DISA challenge windows (Vietnam UTC+7), not venue opening hours.
public sealed record DiscoveryCheckpoint(string Title, string Place, string Instruction, string Difficulty,
    double Latitude, double Longitude, int FromHour, int UntilHour, int Bonus, string? PartnerKey, bool RequiresWindow = false)
{
    public static DiscoveryCheckpoint? For(string area, int order) => (area, order) switch
    {
        ("Đà Lạt" or "Lâm Đồng", 1) => new("Săn chi tiết kiến trúc Đà Lạt", "Lat Valley Villa", "Tìm một chi tiết kiến trúc ở mặt tiền, chụp từ khu vực được phép; không cần đặt phòng.", "easy", 11.9341257, 108.4475181, 14, 16, 10, "lat-valley-villa"),
        // Shoreline viewpoint: https://www.openstreetmap.org/node/11598941137
        ("Đà Lạt" or "Lâm Đồng", 4) => new("Nhật ký âm thanh hồ Tuyền Lâm", "Điểm ngắm hồ Tuyền Lâm", "Từ điểm ngắm trên bờ, quay một đoạn phim ít nhất 5 giây ghi lại âm thanh và cảnh quan. Không cần xuống nước.", "advanced", 11.89955, 108.43730, 7, 9, 30, null),
        ("TP. Hồ Chí Minh", 1) => new("Khám phá góc cà phê Bắc Hải", "Su's House Coffee", "Tìm biển hiệu của quán và chụp một chi tiết khiến bạn nhận ra nơi này. Không cần mua hàng.", "easy", 10.7796465, 106.6637412, 14, 16, 10, "sus-house-coffee"),
        ("Phú Quốc", 1) => new("Bưu thiếp Sonasea", "Emerald Boutique Hotel Phú Quốc", "Từ lối vào công cộng, tìm và chụp một chi tiết nhận diện khu phố Sonasea.", "medium", 10.1339473, 103.9838179, 8, 10, 20, "emerald-phu-quoc"),
        ("Đà Lạt", 2) => new("Bảng màu sớm Đa Phú", "Đồi Đa Phú", "Chọn lối được phép, chụp hai lớp cảnh đồi và trời từ điểm đứng vững. Không cần có mây; bỏ qua nếu đường tối hoặc trơn.", "advanced", 11.9820625, 108.4038125, 5, 7, 30, null, true),
        ("Đà Lạt", 3) => new("Săn mây không cần gặp mây", "Đồi Thiên Phúc Đức", "Dùng hàng thông làm tiền cảnh cho thung lũng buổi sớm. Đi cùng người biết đường; không vào đất rào kín.", "advanced", 11.9946058, 108.4285696, 5, 7, 30, null, true),
        ("Phú Quốc", 2) => new("Bưu thiếp bình minh phía đông đảo", "Ven bờ Hàm Ninh", "Từ đường ven bờ, đặt bóng thuyền hoặc đường chân trời vào ảnh sáng sớm. Không lên cầu cảng hay xuống nước.", "medium", 10.1809348, 104.048461, 5, 7, 20, null, true),
        ("Phú Quốc", 4) => new("Một phút nghe làng chài", "Ven bờ Hàm Ninh", "Ghi ít nhất 5 giây âm thanh ven bờ, không quay cận mặt người dân.", "easy", 10.1809348, 104.048461, 7, 9, 10, null),
        ("Đà Nẵng", 1) => new("Giải mã cánh diều", "Công viên APEC", "Tìm góc để các thanh mái vòm tạo thành một đường chéo xuyên khung ảnh.", "easy", 16.058, 108.22317, 8, 10, 10, null),
        ("Đà Nẵng", 4) => new("Bóng đổ bên sông Hàn", "Công viên APEC", "Quay từ bóng của mái vòm trên lối đi lên chính kết cấu tạo ra nó. Nếu trời râm, tìm đường nét tương phản.", "medium", 16.058, 108.22317, 15, 17, 20, null),
        ("Vũng Tàu", 1) => new("Đóng khung Bãi Trước", "Công viên Bãi Trước", "Chọn hai thân cây làm khung tự nhiên cho đường cong bờ biển.", "easy", 10.34363, 107.07436, 16, 18, 10, null),
        ("Vũng Tàu", 4) => new("Đếm nhịp phố biển", "Công viên Bãi Trước", "Từ đường dạo, ghi một cảnh tĩnh ít nhất 5 giây có hai chuyển động khác nhau như sóng và lá.", "medium", 10.34363, 107.07436, 6, 8, 20, null),
        ("Huế", 1) => new("Trục đối xứng kinh thành", "Khoảng sân phía trước Ngọ Môn", "Đứng ngoài lối lưu thông, chọn điểm chính giữa để hai bên cổng cân nhau trong ảnh; không cần mua vé.", "medium", 16.46715, 107.57974, 7, 9, 20, null),
        ("Huế", 4) => new("Đọc kiến trúc bằng đường mái", "Trước Ngọ Môn", "Quay từ một vòm cửa lên các tầng mái, không bước lùi khi đang nhìn vào màn hình.", "easy", 16.46715, 107.57974, 15, 17, 10, null),
        ("Nha Trang", 1) => new("Tìm cánh hoa trong kiến trúc", "Quảng trường cạnh Tháp Trầm Hương", "Chụp một chi tiết có hình cánh hoa thay vì chụp toàn bộ tháp.", "easy", 12.24048, 109.1968, 7, 9, 10, null),
        ("Nha Trang", 4) => new("Từ phố ra biển", "Quảng trường cạnh Tháp Trầm Hương", "Đứng trên đường đi bộ, quay một cú máy từ tháp tới chân trời biển, giữ khung cuối 5 giây.", "medium", 12.24048, 109.1968, 5, 7, 20, null),
        ("TP. Hồ Chí Minh", 2) => new("Mặt đồng hồ giữa phố chợ", "Cửa Nam chợ Bến Thành", "Từ vỉa hè tìm góc ghép đồng hồ trên mái chợ và một chi tiết phố vào cùng khung. Không bước xuống đường.", "medium", 10.7716, 106.6981, 7, 9, 20, null),
        ("TP. Hồ Chí Minh", 4) => new("Đường cong của bưu điện", "Bưu điện Trung tâm Sài Gòn", "Từ sân trước quay qua ba vòm cửa liên tiếp, dừng ở chi tiết đồng hồ; tránh ghi hình người gửi thư.", "easy", 10.7798, 106.699, 8, 10, 10, null),
        _ => null
    };

    public bool Matches(double lat, double lon, double accuracy, DateTimeOffset fix, DateTimeOffset now)
    {
        if (!double.IsFinite(lat) || !double.IsFinite(lon) || !double.IsFinite(accuracy)
            || Math.Abs(lat)>90 || Math.Abs(lon)>180 || accuracy is <=0 or >65
            || fix > now.AddSeconds(10) || fix < now.AddMinutes(-3)) return false;
        const double rad = Math.PI / 180;
        double h = Math.Pow(Math.Sin((lat-Latitude)*rad/2),2) + Math.Cos(lat*rad)*Math.Cos(Latitude*rad)*Math.Pow(Math.Sin((lon-Longitude)*rad/2),2);
        return 12742000 * Math.Asin(Math.Sqrt(Math.Clamp(h, 0, 1))) <= 120;
    }

    public int BonusAt(DateTimeOffset utc) => utc.ToOffset(TimeSpan.FromHours(7)).Hour is var hour && hour >= FromHour && hour < UntilHour ? Bonus : 0;
}
