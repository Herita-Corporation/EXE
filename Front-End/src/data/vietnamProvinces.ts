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
 */

export interface ProvinceHighlight {
  /** Tên khu vực/địa danh nổi bật, hiển thị cho user chọn. */
  name: string;
}

export interface Province {
  name: string;
  highlights: ProvinceHighlight[];
}

function h(...names: string[]): ProvinceHighlight[] {
  return names.map((name) => ({ name }));
}

export const VIETNAM_PROVINCES: Province[] = [
  // ── 6 thành phố trực thuộc trung ương ──────────────────────────────────
  { name: "Hà Nội", highlights: h("Hoàn Kiếm", "Ba Đình", "Tây Hồ", "Hà Đông", "Sơn Tây", "Ba Vì") },
  { name: "Hồ Chí Minh", highlights: h("Quận 1", "Thủ Đức", "Vũng Tàu", "Côn Đảo", "Thủ Dầu Một", "Cần Giờ") },
  { name: "Hải Phòng", highlights: h("Đồ Sơn", "Cát Bà", "Lê Chân", "Côn Sơn - Kiếp Bạc", "Hải Dương") },
  { name: "Đà Nẵng", highlights: h("Sơn Trà", "Ngũ Hành Sơn", "Hải Châu", "Hội An", "Mỹ Sơn", "Cù Lao Chàm") },
  { name: "Huế", highlights: h("Kinh thành Huế", "Bạch Mã", "Thuận An", "Lăng Tự Đức", "Cầu Ngói Thanh Toàn") },
  { name: "Cần Thơ", highlights: h("Ninh Kiều", "Cái Răng", "Phong Điền", "Sóc Trăng", "Vị Thanh") },

  // ── 28 tỉnh ─────────────────────────────────────────────────────────────
  { name: "Tuyên Quang", highlights: h("Tuyên Quang", "Na Hang", "Đồng Văn", "Mèo Vạc", "Lũng Cú") },
  { name: "Lào Cai", highlights: h("Sa Pa", "Bắc Hà", "Mù Cang Chải", "Yên Bái") },
  { name: "Thái Nguyên", highlights: h("Hồ Núi Cốc", "Tân Cương", "Ba Bể", "Bắc Kạn") },
  { name: "Phú Thọ", highlights: h("Đền Hùng", "Tam Đảo", "Mai Châu", "Hòa Bình") },
  { name: "Bắc Ninh", highlights: h("Đồng Kỵ", "Tây Yên Tử", "Bắc Giang", "Chùa Bút Tháp") },
  { name: "Hưng Yên", highlights: h("Phố Hiến", "Văn Miếu Xích Đằng", "Thái Bình") },
  { name: "Ninh Bình", highlights: h("Tràng An", "Tam Cốc", "Hoa Lư", "Chùa Tam Chúc", "Phủ Dầy") },
  { name: "Quảng Trị", highlights: h("Phong Nha - Kẻ Bàng", "Địa đạo Vịnh Mốc", "Thành cổ Quảng Trị", "Cửa Tùng") },
  { name: "Quảng Ngãi", highlights: h("Lý Sơn", "Sa Huỳnh", "Măng Đen", "Kon Tum") },
  { name: "Gia Lai", highlights: h("Quy Nhơn", "Biển Hồ", "Kbang", "Tây Sơn") },
  { name: "Khánh Hòa", highlights: h("Nha Trang", "Vịnh Vĩnh Hy", "Ninh Chữ", "Đảo Bình Ba") },
  { name: "Lâm Đồng", highlights: h("Đà Lạt", "Mũi Né", "Phan Thiết", "Đắk Nông") },
  { name: "Đắk Lắk", highlights: h("Buôn Ma Thuột", "Gành Đá Đĩa", "Tuy Hòa", "Hồ Lắk") },
  { name: "Đồng Nai", highlights: h("Biên Hòa", "Nam Cát Tiên", "Bình Phước") },
  { name: "Tây Ninh", highlights: h("Núi Bà Đen", "Tòa Thánh Cao Đài", "Long An", "Đồng Tháp Mười") },
  { name: "Vĩnh Long", highlights: h("Cồn Chim", "Cù Lao An Bình", "Bến Tre", "Trà Vinh") },
  { name: "Đồng Tháp", highlights: h("Tràm Chim", "Sa Đéc", "Mỹ Tho", "Cái Bè") },
  { name: "Cà Mau", highlights: h("Mũi Cà Mau", "U Minh Hạ", "Bạc Liêu") },
  { name: "An Giang", highlights: h("Phú Quốc", "Núi Sam - Châu Đốc", "Hà Tiên", "Rừng Tràm Trà Sư") },
  { name: "Cao Bằng", highlights: h("Thác Bản Giốc", "Động Ngườm Ngao", "Hồ Thang Hen") },
  { name: "Lai Châu", highlights: h("Sìn Hồ", "Cầu Kính Rồng Mây", "Pu Ta Leng") },
  { name: "Điện Biên", highlights: h("Điện Biên Phủ", "Đèo Pha Đin", "A Pa Chải") },
  { name: "Sơn La", highlights: h("Mộc Châu", "Sông Đà", "Vân Hồ") },
  { name: "Lạng Sơn", highlights: h("Động Tam Thanh", "Chợ Đông Kinh", "Mẫu Sơn") },
  { name: "Quảng Ninh", highlights: h("Hạ Long", "Cô Tô", "Móng Cái", "Vân Đồn", "Yên Tử") },
  { name: "Thanh Hóa", highlights: h("Sầm Sơn", "Thành Nhà Hồ", "Pù Luông") },
  { name: "Nghệ An", highlights: h("Cửa Lò", "Kim Liên", "Vinh") },
  { name: "Hà Tĩnh", highlights: h("Thiên Cầm", "Chùa Hương Tích", "Ngã Ba Đồng Lộc") },
];
