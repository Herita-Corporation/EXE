/**
 * Danh sách tỉnh/thành Việt Nam dùng cho màn "Tạo lịch trình".
 *
 * Dùng theo bản đồ hành chính hiện tại (sau đợt sáp nhập có hiệu lực từ
 * 1/7/2025: 63 tỉnh/thành cũ gộp còn 34 — 28 tỉnh + 6 thành phố trực thuộc
 * trung ương). Cấp huyện cũng đã bị bỏ (chỉ còn tỉnh → xã/phường), nên
 * `highlights` KHÔNG phải danh sách hành chính đầy đủ (mỗi tỉnh có thể có
 * hàng trăm xã/phường) — đây là danh sách rút gọn các khu vực/địa danh du
 * lịch nổi bật nhất của tỉnh đó, để user chọn nhanh nếu muốn cụ thể hơn là
 * cả tỉnh. Tên gọi ưu tiên theo cách gọi quen thuộc với du khách (có thể là
 * tên phường/xã, thị trấn, hoặc địa danh) hơn là tên hành chính chính thức.
 *
 * Mỗi tỉnh liệt kê khu vực theo thứ tự ưu tiên; `featured` đầu tiên được
 * đánh dấu "nổi bật" và hiển thị lên đầu kèm ảnh lớn trong màn chọn khu vực.
 */

export interface ProvinceHighlight {
  /** Tên khu vực/địa danh nổi bật, hiển thị cho user chọn. */
  name: string;
  /** Mô tả ngắn để user hình dung khu vực (điểm đến, đặc trưng). */
  note: string;
  /** Khu vực nổi bật nhất của tỉnh — hiển thị lên đầu danh sách. */
  featured: boolean;
}

export interface Province {
  name: string;
  highlights: ProvinceHighlight[];
}

/** Builds a province; the first `featured` areas are marked as highlights. */
function p(name: string, featured: number, areas: Array<[string, string]>): Province {
  return {
    name,
    highlights: areas.map(([areaName, note], i) => ({ name: areaName, note, featured: i < featured })),
  };
}

export const VIETNAM_PROVINCES: Province[] = [
  // ── 6 thành phố trực thuộc trung ương ──────────────────────────────────
  p("Hà Nội", 3, [
    ["Hoàn Kiếm", "Hồ Gươm, phố cổ, phố đi bộ"],
    ["Ba Đình", "Lăng Bác, Hoàng thành Thăng Long"],
    ["Tây Hồ", "Hồ Tây, chùa Trấn Quốc"],
    ["Hà Đông", "Làng lụa Vạn Phúc"],
    ["Sơn Tây", "Làng cổ Đường Lâm, đền Và"],
    ["Ba Vì", "Vườn quốc gia, khí hậu mát mẻ"],
  ]),
  p("Hồ Chí Minh", 4, [
    // ── Khu vực nổi bật nhất ──────────────────────────────────────────
    ["Quận 1", "Chợ Bến Thành, phố đi bộ Nguyễn Huệ"],
    ["Quận 3", "Hồ Con Rùa, phố cà phê"],
    ["Bình Thạnh", "Lăng Ông Bà Chiểu, Landmark 81"],
    ["Thủ Đức", "Thảo Điền, khu đô thị Thủ Thiêm"],
    // ── Các quận trung tâm ───────────────────────────────────────────
    ["Quận 4", "Ẩm thực đường phố, Bến Nhà Rồng"],
    ["Quận 5", "Chợ Lớn, khu phố người Hoa"],
    ["Quận 7", "Phú Mỹ Hưng, hồ Bán Nguyệt"],
    ["Quận 10", "Ẩm thực, chợ hoa Hồ Thị Kỷ"],
    ["Quận 11", "Công viên Đầm Sen"],
    ["Gò Vấp", "Khu dân cư sôi động, quán ăn bình dân"],
    ["Tân Bình", "Sân bay Tân Sơn Nhất, chùa Giác Lâm"],
    ["Phú Nhuận", "Công viên Gia Định, phố Phan Xích Long"],
    // ── Ngoại ô & du lịch ────────────────────────────────────────────
    ["Củ Chi", "Địa đạo Củ Chi"],
    ["Cần Giờ", "Rừng ngập mặn, đảo Khỉ, biển"],
    ["Bình Chánh", "Vùng ven, khu du lịch Lê Minh Xuân"],
    ["Hóc Môn", "Vùng ven, nông trại sinh thái"],
    ["Nhà Bè", "Vùng sông nước ven đô"],
  ]),
  p("Hải Phòng", 3, [
    ["Cát Bà", "Đảo, vịnh Lan Hạ"],
    ["Đồ Sơn", "Bãi biển, lễ hội chọi trâu"],
    ["Lê Chân", "Trung tâm thành phố, ẩm thực"],
    ["Côn Sơn - Kiếp Bạc", "Khu di tích Côn Sơn, đền Kiếp Bạc"],
    ["Hải Dương", "Thành phố Hải Dương, bánh đậu xanh"],
  ]),
  p("Đà Nẵng", 3, [
    ["Hội An", "Phố cổ, đèn lồng, sông Hoài"],
    ["Sơn Trà", "Bán đảo, chùa Linh Ứng, biển Mỹ Khê"],
    ["Hải Châu", "Cầu Rồng, sông Hàn"],
    ["Ngũ Hành Sơn", "Núi đá cẩm thạch, hang động"],
    ["Mỹ Sơn", "Thánh địa Chăm Pa, di sản thế giới"],
    ["Cù Lao Chàm", "Đảo, lặn ngắm san hô"],
  ]),
  p("Huế", 3, [
    ["Kinh thành Huế", "Đại Nội, Ngọ Môn"],
    ["Lăng Tự Đức", "Lăng tẩm triều Nguyễn"],
    ["Thuận An", "Biển Thuận An, phá Tam Giang"],
    ["Bạch Mã", "Vườn quốc gia, thác Đỗ Quyên"],
    ["Cầu Ngói Thanh Toàn", "Cầu ngói cổ, làng quê yên bình"],
  ]),
  p("Cần Thơ", 3, [
    ["Cái Răng", "Chợ nổi Cái Răng"],
    ["Ninh Kiều", "Bến Ninh Kiều, chợ đêm"],
    ["Phong Điền", "Vườn trái cây, chợ nổi Phong Điền"],
    ["Sóc Trăng", "Chùa Dơi, chùa Khmer"],
    ["Vị Thanh", "Hậu Giang, sông nước miền Tây"],
  ]),

  // ── 28 tỉnh ─────────────────────────────────────────────────────────────
  p("Tuyên Quang", 3, [
    ["Đồng Văn", "Cao nguyên đá, phố cổ Đồng Văn"],
    ["Mèo Vạc", "Đèo Mã Pí Lèng, sông Nho Quế"],
    ["Lũng Cú", "Cột cờ cực Bắc"],
    ["Na Hang", "Hồ thủy điện giữa núi đá"],
    ["Tuyên Quang", "Khu di tích Tân Trào"],
  ]),
  p("Lào Cai", 3, [
    ["Sa Pa", "Fansipan, ruộng bậc thang"],
    ["Mù Cang Chải", "Ruộng bậc thang mùa lúa chín"],
    ["Bắc Hà", "Chợ phiên, dinh Hoàng A Tưởng"],
    ["Yên Bái", "Hồ Thác Bà"],
  ]),
  p("Thái Nguyên", 3, [
    ["Ba Bể", "Hồ Ba Bể, vườn quốc gia"],
    ["Hồ Núi Cốc", "Hồ nước, khu du lịch sinh thái"],
    ["Tân Cương", "Đồi chè nổi tiếng"],
    ["Bắc Kạn", "Núi rừng, bản làng"],
  ]),
  p("Phú Thọ", 3, [
    ["Đền Hùng", "Đền thờ các Vua Hùng"],
    ["Tam Đảo", "Thị trấn trên mây"],
    ["Mai Châu", "Bản Lác, nhà sàn người Thái"],
    ["Hòa Bình", "Hồ thủy điện Hòa Bình"],
  ]),
  p("Bắc Ninh", 3, [
    ["Chùa Bút Tháp", "Chùa cổ, kiến trúc gỗ"],
    ["Tây Yên Tử", "Chùa và cáp treo Tây Yên Tử"],
    ["Đồng Kỵ", "Làng nghề gỗ mỹ nghệ"],
    ["Bắc Giang", "Vùng vải thiều Lục Ngạn"],
  ]),
  p("Hưng Yên", 3, [
    ["Phố Hiến", "Thương cảng cổ, nhãn lồng"],
    ["Văn Miếu Xích Đằng", "Văn miếu cổ"],
    ["Thái Bình", "Chùa Keo, biển Đồng Châu"],
  ]),
  p("Ninh Bình", 3, [
    ["Tràng An", "Di sản thế giới, đi thuyền qua hang"],
    ["Tam Cốc", "Ruộng lúa, Bích Động"],
    ["Hoa Lư", "Cố đô, đền vua Đinh - vua Lê"],
    ["Chùa Tam Chúc", "Quần thể chùa lớn bên hồ"],
    ["Phủ Dầy", "Quần thể thờ Mẫu Liễu Hạnh"],
  ]),
  p("Quảng Trị", 3, [
    ["Phong Nha - Kẻ Bàng", "Động Phong Nha, hang Sơn Đoòng"],
    ["Cửa Tùng", "Bãi biển"],
    ["Thành cổ Quảng Trị", "Di tích lịch sử chiến tranh"],
    ["Địa đạo Vịnh Mốc", "Làng hầm thời chiến"],
  ]),
  p("Quảng Ngãi", 3, [
    ["Lý Sơn", "Đảo núi lửa, vương quốc tỏi"],
    ["Măng Đen", "Cao nguyên rừng thông, khí hậu mát"],
    ["Sa Huỳnh", "Biển, đầm nước mặn"],
    ["Kon Tum", "Nhà thờ gỗ, nhà rông"],
  ]),
  p("Gia Lai", 3, [
    ["Quy Nhơn", "Biển, Eo Gió, Kỳ Co"],
    ["Biển Hồ", "Hồ trên miệng núi lửa ở Pleiku"],
    ["Tây Sơn", "Bảo tàng Quang Trung, võ Bình Định"],
    ["Kbang", "Thác K50, rừng nguyên sinh"],
  ]),
  p("Khánh Hòa", 3, [
    ["Nha Trang", "Biển, VinWonders, tháp Bà Ponagar"],
    ["Vịnh Vĩnh Hy", "Vịnh biển, lặn ngắm san hô"],
    ["Đảo Bình Ba", "Đảo tôm hùm"],
    ["Ninh Chữ", "Bãi biển Ninh Thuận"],
  ]),
  p("Lâm Đồng", 3, [
    ["Đà Lạt", "Thành phố ngàn hoa, khí hậu mát"],
    ["Mũi Né", "Đồi cát, resort biển"],
    ["Phan Thiết", "Biển, làng chài, thanh long"],
    ["Đắk Nông", "Thác Đray Sáp, công viên địa chất"],
  ]),
  p("Đắk Lắk", 3, [
    ["Buôn Ma Thuột", "Thủ phủ cà phê"],
    ["Gành Đá Đĩa", "Bãi đá bazan kỳ thú"],
    ["Tuy Hòa", "Biển, tháp Nhạn"],
    ["Hồ Lắk", "Hồ nước, buôn Jun"],
  ]),
  p("Đồng Nai", 2, [
    ["Nam Cát Tiên", "Vườn quốc gia, rừng nhiệt đới"],
    ["Biên Hòa", "Văn miếu Trấn Biên, sông Đồng Nai"],
    ["Bình Phước", "Vườn điều, núi Bà Rá"],
  ]),
  p("Tây Ninh", 2, [
    ["Núi Bà Đen", "Nóc nhà Nam Bộ, cáp treo"],
    ["Tòa Thánh Cao Đài", "Thánh thất đạo Cao Đài"],
    ["Đồng Tháp Mười", "Đồng sen, rừng tràm"],
    ["Long An", "Đồng bằng, làng nổi Tân Lập"],
  ]),
  p("Vĩnh Long", 3, [
    ["Bến Tre", "Xứ dừa, kênh rạch"],
    ["Cù Lao An Bình", "Vườn trái cây, homestay miệt vườn"],
    ["Trà Vinh", "Chùa Khmer, ao Bà Om"],
    ["Cồn Chim", "Cù lao, du lịch cộng đồng"],
  ]),
  p("Đồng Tháp", 3, [
    ["Sa Đéc", "Làng hoa, nhà cổ Huỳnh Thủy Lê"],
    ["Tràm Chim", "Vườn quốc gia, sếu đầu đỏ"],
    ["Cái Bè", "Chợ nổi, vườn trái cây"],
    ["Mỹ Tho", "Cồn Thới Sơn, sông Tiền"],
  ]),
  p("Cà Mau", 2, [
    ["Mũi Cà Mau", "Cực Nam Tổ quốc"],
    ["Bạc Liêu", "Nhà Công tử Bạc Liêu, cánh đồng điện gió"],
    ["U Minh Hạ", "Rừng tràm U Minh"],
  ]),
  p("An Giang", 3, [
    ["Phú Quốc", "Đảo ngọc, biển và resort"],
    ["Núi Sam - Châu Đốc", "Miếu Bà Chúa Xứ"],
    ["Rừng Tràm Trà Sư", "Rừng tràm, đi xuồng"],
    ["Hà Tiên", "Biển, thạch động"],
  ]),
  p("Cao Bằng", 2, [
    ["Thác Bản Giốc", "Thác nước biên giới hùng vĩ"],
    ["Động Ngườm Ngao", "Hang động thạch nhũ"],
    ["Hồ Thang Hen", "Hồ nước trên núi đá"],
  ]),
  p("Lai Châu", 2, [
    ["Cầu Kính Rồng Mây", "Cầu kính trên đèo Ô Quy Hồ"],
    ["Pu Ta Leng", "Đỉnh núi, mùa hoa đỗ quyên"],
    ["Sìn Hồ", "Cao nguyên, ruộng bậc thang"],
  ]),
  p("Điện Biên", 2, [
    ["Điện Biên Phủ", "Đồi A1, di tích chiến trường"],
    ["Đèo Pha Đin", "Một trong tứ đại đỉnh đèo"],
    ["A Pa Chải", "Ngã ba biên giới"],
  ]),
  p("Sơn La", 2, [
    ["Mộc Châu", "Đồi chè, mùa hoa mận"],
    ["Sông Đà", "Hồ thủy điện, du thuyền"],
    ["Vân Hồ", "Bản làng dân tộc, đồi chè"],
  ]),
  p("Lạng Sơn", 2, [
    ["Mẫu Sơn", "Núi cao, săn mây và băng tuyết"],
    ["Động Tam Thanh", "Hang động, chùa Tam Thanh"],
    ["Chợ Đông Kinh", "Chợ biên giới sầm uất"],
  ]),
  p("Quảng Ninh", 3, [
    ["Hạ Long", "Vịnh di sản thế giới"],
    ["Cô Tô", "Đảo biển hoang sơ"],
    ["Yên Tử", "Non thiêng Phật giáo Trúc Lâm"],
    ["Vân Đồn", "Đảo Quan Lạn, Minh Châu"],
    ["Móng Cái", "Cửa khẩu, biển Trà Cổ"],
  ]),
  p("Thanh Hóa", 2, [
    ["Sầm Sơn", "Bãi biển"],
    ["Pù Luông", "Ruộng bậc thang, rừng nguyên sinh"],
    ["Thành Nhà Hồ", "Di sản thế giới, thành đá cổ"],
  ]),
  p("Nghệ An", 2, [
    ["Cửa Lò", "Bãi biển"],
    ["Kim Liên", "Quê Bác, làng Sen"],
    ["Vinh", "Thành phố, quảng trường Hồ Chí Minh"],
  ]),
  p("Hà Tĩnh", 2, [
    ["Thiên Cầm", "Bãi biển"],
    ["Chùa Hương Tích", "Chùa trên núi Hồng Lĩnh"],
    ["Ngã Ba Đồng Lộc", "Di tích lịch sử chiến tranh"],
  ]),
];
