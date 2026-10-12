// Real photos for the region picker, keyed by exact province OR highlight
// name (src/data/vietnamProvinces.ts). Remote photos come from Wikimedia
// Commons (each area's Wikipedia lead image or a matching Commons photo);
// bundled require() assets are used where we ship one (offline-safe).
// Areas without a photo here fall back to their province's photo.

import type { ImageSource } from "expo-image";

type RegionImageSource = ImageSource | number;

// ── Local bundled assets (offline-safe) ─────────────────────────────────────
const LOCAL_HO_GUOM: number  = require("@/assets/images/missions/ho-guom.jpg");
const LOCAL_HOI_AN: number   = require("@/assets/images/missions/hoi-an-den-hoa-dang.jpg");
const LOCAL_CAI_RANG: number = require("@/assets/images/missions/cho-noi-cai-rang.jpg");
const LOCAL_FANSIPAN: number = require("@/assets/images/missions/fansipan.jpg");

// Wikimedia rejects generic HTTP-client user agents (e.g. Android's
// "okhttp/x"), so send an identifying one per their robot policy.
const WIKIMEDIA_HEADERS = { "User-Agent": "DISA-Travel/1.0 (React Native app; expo-image)" };

function w(uri: string): ImageSource {
  return { uri, headers: WIKIMEDIA_HEADERS, cacheKey: uri };
}

/** Image source for a URL coming from the backend (voucher/event images) —
 * adds the User-Agent Wikimedia requires, otherwise Android's okhttp gets 403. */
export function remoteImage(uri: string | null | undefined): ImageSource | undefined {
  if (!uri) return undefined;
  return /(^|\.)wikimedia\.org\//.test(uri) ? w(uri) : { uri };
}

// ── Region image map ─────────────────────────────────────────────────────────
const REGION_IMAGES: Record<string, RegionImageSource> = {
  // ── Hà Nội ──────────────────────────────────────────────────────
  "Hà Nội": LOCAL_HO_GUOM,
  "Hoàn Kiếm": LOCAL_HO_GUOM,
  "Ba Đình": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/35/L%C4%83ng_Ch%E1%BB%A7_t%E1%BB%8Bch_H%E1%BB%93_Ch%C3%AD_Minh%2C_H%C3%A0_N%E1%BB%99i.jpeg/960px-L%C4%83ng_Ch%E1%BB%A7_t%E1%BB%8Bch_H%E1%BB%93_Ch%C3%AD_Minh%2C_H%C3%A0_N%E1%BB%99i.jpeg"),
  "Tây Hồ": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/H%E1%BB%93_T%C3%A2y_ho%C3%A0ng_h%C3%B4n_-_NKS.jpg/960px-H%E1%BB%93_T%C3%A2y_ho%C3%A0ng_h%C3%B4n_-_NKS.jpg"),
  "Hà Đông": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Elephant_decorations_on_a_Buddhist_temple_in_H%C3%A0-%C3%90%C3%B4ng.jpg/960px-Elephant_decorations_on_a_Buddhist_temple_in_H%C3%A0-%C3%90%C3%B4ng.jpg"),
  "Sơn Tây": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/%C4%90%E1%BB%81n_V%C3%A0%2C_S%C6%A1n_T%C3%A2y_-_8867526479.jpg/960px-%C4%90%E1%BB%81n_V%C3%A0%2C_S%C6%A1n_T%C3%A2y_-_8867526479.jpg"),
  "Ba Vì": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Ba_V%C3%AC_National_Park%2C_foggy_road.jpg/960px-Ba_V%C3%AC_National_Park%2C_foggy_road.jpg"),

  // ── Hồ Chí Minh ─────────────────────────────────────────────────
  "Hồ Chí Minh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/Ho_Chi_Minh_City%2C_City_Hall%2C_2020-01_CN-03.jpg/960px-Ho_Chi_Minh_City%2C_City_Hall%2C_2020-01_CN-03.jpg"),
  "Quận 1": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Ho_Chi_Minh_centre_%2827767549369%29.jpg/960px-Ho_Chi_Minh_centre_%2827767549369%29.jpg"),
  "Quận 3": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/H%E1%BB%93_Con_R%C3%B9a.JPG/960px-H%E1%BB%93_Con_R%C3%B9a.JPG"),
  "Bình Thạnh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/Lang_Ong_ba_Chieu_Binh_thanh_-_panoramio.jpg/960px-Lang_Ong_ba_Chieu_Binh_thanh_-_panoramio.jpg"),
  "Thủ Đức": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Ch%E1%BB%A3_Th%E1%BB%A7_%C4%90%E1%BB%A9c.jpg/960px-Ch%E1%BB%A3_Th%E1%BB%A7_%C4%90%E1%BB%A9c.jpg"),
  "Quận 4": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Ben_Nha_Rong_ve_dem.JPG/960px-Ben_Nha_Rong_ve_dem.JPG"),
  "Quận 5": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/H%E1%BB%99i_qu%C3%A1n_Tu%E1%BB%87_Th%C3%A0nh.jpg/960px-H%E1%BB%99i_qu%C3%A1n_Tu%E1%BB%87_Th%C3%A0nh.jpg"),
  "Quận 7": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/Phu_My_Hung%2C_HCM_City_5.jpg/960px-Phu_My_Hung%2C_HCM_City_5.jpg"),
  "Quận 10": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Trung_Tam_The_Duc_the_Thao_Thong_Nhat%2Cphuong_6%2C_q10%2C_tphcmvn_-_panoramio.jpg/960px-Trung_Tam_The_Duc_the_Thao_Thong_Nhat%2Cphuong_6%2C_q10%2C_tphcmvn_-_panoramio.jpg"),
  "Quận 11": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Dam-sen-tuonglamphotos.jpg/960px-Dam-sen-tuonglamphotos.jpg"),
  "Gò Vấp": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Nguyen_van_nghi%2C_p7%2C_Go_vap_%2C_hcmvn_-_panoramio.jpg/960px-Nguyen_van_nghi%2C_p7%2C_Go_vap_%2C_hcmvn_-_panoramio.jpg"),
  "Tân Bình": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/ChuaGiacLam01.jpg/960px-ChuaGiacLam01.jpg"),
  "Phú Nhuận": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/C%C3%B4ng_vi%C3%AAn_Gia_%C4%90%E1%BB%8Bnh%2C_Ph%C6%B0%E1%BB%9Dng_9%2C_Qu%E1%BA%ADn_Ph%C3%BA_Nhu%E1%BA%ADn.jpg/960px-C%C3%B4ng_vi%C3%AAn_Gia_%C4%90%E1%BB%8Bnh%2C_Ph%C6%B0%E1%BB%9Dng_9%2C_Qu%E1%BA%ADn_Ph%C3%BA_Nhu%E1%BA%ADn.jpg"),
  "Bình Chánh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/L%C3%AA_Minh_Xu%C3%A2n%2C_B%C3%ACnh_Ch%C3%A1nh%2C_TP._HCM.jpg/960px-L%C3%AA_Minh_Xu%C3%A2n%2C_B%C3%ACnh_Ch%C3%A1nh%2C_TP._HCM.jpg"),
  "Hóc Môn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Ho%C3%A0ng_h%C3%B4n_t%E1%BA%A1i_H%C3%B3c_M%C3%B4n_ng%C3%A0y_31_th%C3%A1ng_10_n%C4%83m_2021.jpg/960px-Ho%C3%A0ng_h%C3%B4n_t%E1%BA%A1i_H%C3%B3c_M%C3%B4n_ng%C3%A0y_31_th%C3%A1ng_10_n%C4%83m_2021.jpg"),
  "Củ Chi": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/C%E1%BB%A7_Chi_tunnels_entrance.JPG/960px-C%E1%BB%A7_Chi_tunnels_entrance.JPG"),
  "Cần Giờ": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Mangrove_in_Can_Gio_forest.jpg/960px-Mangrove_in_Can_Gio_forest.jpg"),
  "Nhà Bè": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Hi%E1%BB%87p_Ph%C6%B0%E1%BB%9Bc%2C_Nh%C3%A0_B%C3%A8%2C_TPHCM%2C_Vietnam_-_panoramio.jpg/960px-Hi%E1%BB%87p_Ph%C6%B0%E1%BB%9Bc%2C_Nh%C3%A0_B%C3%A8%2C_TPHCM%2C_Vietnam_-_panoramio.jpg"),

  // ── Hải Phòng ───────────────────────────────────────────────────
  "Hải Phòng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e6/S%C3%B4ng_C%E1%BA%A5m_H%E1%BA%A3i_Ph%C3%B2ng_V%E1%BB%81_%C4%90%C3%AAm_n%C4%83m_2025.jpg/960px-S%C3%B4ng_C%E1%BA%A5m_H%E1%BA%A3i_Ph%C3%B2ng_V%E1%BB%81_%C4%90%C3%AAm_n%C4%83m_2025.jpg"),
  "Đồ Sơn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Khu_du_l%E1%BB%8Bch_%C4%90%E1%BB%93_S%C6%A1n%2C_%C4%90%E1%BB%93_S%C6%A1n%2C_H%E1%BA%A3i_Ph%C3%B2ng%2C_Vietnam_-_panoramio.jpg/960px-Khu_du_l%E1%BB%8Bch_%C4%90%E1%BB%93_S%C6%A1n%2C_%C4%90%E1%BB%93_S%C6%A1n%2C_H%E1%BA%A3i_Ph%C3%B2ng%2C_Vietnam_-_panoramio.jpg"),
  "Cát Bà": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Cat_Ba_Town_6.jpg/960px-Cat_Ba_Town_6.jpg"),
  "Lê Chân": w("https://upload.wikimedia.org/wikipedia/commons/1/1b/MADAM_LE_CHAN_STATUE.jpg"),
  "Côn Sơn - Kiếp Bạc": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Ki%E1%BA%BFp_B%E1%BA%A1c_temple_in_1904.jpg/960px-Ki%E1%BA%BFp_B%E1%BA%A1c_temple_in_1904.jpg"),
  "Hải Dương": w("https://upload.wikimedia.org/wikipedia/commons/f/f1/Ho_Bach_Dang.jpg"),

  // ── Đà Nẵng ─────────────────────────────────────────────────────
  "Đà Nẵng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/B%E1%BB%9D_%C4%91%C3%B4ng_c%E1%BA%A7u_R%E1%BB%93ng.jpg/960px-B%E1%BB%9D_%C4%91%C3%B4ng_c%E1%BA%A7u_R%E1%BB%93ng.jpg"),
  "Sơn Trà": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/Ban_dao_Son_Tra.jpg/960px-Ban_dao_Son_Tra.jpg"),
  "Ngũ Hành Sơn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Ngu_hanh_son_toan_canh.jpg/960px-Ngu_hanh_son_toan_canh.jpg"),
  "Hải Châu": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Han_River_Bridge_in_Vietnam_Night_View.jpg/960px-Han_River_Bridge_in_Vietnam_Night_View.jpg"),
  "Hội An": LOCAL_HOI_AN,
  "Mỹ Sơn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/2024_-_M%E1%BB%B9_S%C6%A1n_Sanctuary_Temple_E7_-_img_01.jpg/960px-2024_-_M%E1%BB%B9_S%C6%A1n_Sanctuary_Temple_E7_-_img_01.jpg"),
  "Cù Lao Chàm": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/%C4%90%E1%BA%A3o_C%C3%B9_Lao_Ch%C3%A0m_g%C3%B3c_nh%C3%ACn_t%E1%BB%AB_Cano.jpg/960px-%C4%90%E1%BA%A3o_C%C3%B9_Lao_Ch%C3%A0m_g%C3%B3c_nh%C3%ACn_t%E1%BB%AB_Cano.jpg"),

  // ── Huế ─────────────────────────────────────────────────────────
  "Huế": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Th%C3%A0nh_ph%E1%BB%91_Hu%E1%BA%BF_nh%C3%ACn_t%E1%BB%AB_tr%C3%AAn_cao_%282%29.jpg/960px-Th%C3%A0nh_ph%E1%BB%91_Hu%E1%BA%BF_nh%C3%ACn_t%E1%BB%AB_tr%C3%AAn_cao_%282%29.jpg"),
  "Kinh thành Huế": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Ngomon2.jpg/960px-Ngomon2.jpg"),
  "Bạch Mã": w("https://upload.wikimedia.org/wikipedia/commons/4/42/Thacdoquyen.jpg"),
  "Thuận An": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/Tam_Giang_and_Sam-Thanh_Lam_lagoons.jpg/960px-Tam_Giang_and_Sam-Thanh_Lam_lagoons.jpg"),
  "Lăng Tự Đức": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Annam_-_Hu%C3%A9_-_Pavillons_sur_le_bassin_fleuri_au_Tombeau_de_Tu-Duc.jpg/960px-Annam_-_Hu%C3%A9_-_Pavillons_sur_le_bassin_fleuri_au_Tombeau_de_Tu-Duc.jpg"),
  "Cầu Ngói Thanh Toàn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/C%E1%BA%A7u_ng%C3%B3i_Thanh_To%C3%A0n1.jpg/960px-C%E1%BA%A7u_ng%C3%B3i_Thanh_To%C3%A0n1.jpg"),

  // ── Cần Thơ ─────────────────────────────────────────────────────
  "Cần Thơ": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Can_Tho_Bridge.jpg/960px-Can_Tho_Bridge.jpg"),
  "Ninh Kiều": w("https://upload.wikimedia.org/wikipedia/commons/7/70/Ninhkieuquay.jpg"),
  "Cái Răng": LOCAL_CAI_RANG,
  "Phong Điền": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Th%E1%BB%8B_tr%E1%BA%A5n_Phong_%C4%90i%E1%BB%81n.jpg/960px-Th%E1%BB%8B_tr%E1%BA%A5n_Phong_%C4%90i%E1%BB%81n.jpg"),
  "Sóc Trăng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Th%C3%A0nh_ph%E1%BB%91_S%C3%B3c_Tr%C4%83ng._IMG.jpg/960px-Th%C3%A0nh_ph%E1%BB%91_S%C3%B3c_Tr%C4%83ng._IMG.jpg"),
  "Vị Thanh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/V%E1%BB%8B_Thanh_-_H%E1%BA%ADu_Giang.jpg/960px-V%E1%BB%8B_Thanh_-_H%E1%BA%ADu_Giang.jpg"),

  // ── Tuyên Quang ─────────────────────────────────────────────────
  "Tuyên Quang": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/C%E1%BB%99t_C%E1%BB%9D.jpg/960px-C%E1%BB%99t_C%E1%BB%9D.jpg"),
  "Na Hang": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Th%E1%BB%A7y_%C4%91i%E1%BB%87n_Tuy%C3%AAn_Quang.jpg/960px-Th%E1%BB%A7y_%C4%91i%E1%BB%87n_Tuy%C3%AAn_Quang.jpg"),
  "Đồng Văn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/B%C3%A3i_%C4%91%C3%A1_m%E1%BA%B7t_tr%C4%83ng_%C4%90%E1%BB%93ng_V%C4%83n_-_NKS.jpg/960px-B%C3%A3i_%C4%91%C3%A1_m%E1%BA%B7t_tr%C4%83ng_%C4%90%E1%BB%93ng_V%C4%83n_-_NKS.jpg"),
  "Mèo Vạc": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Th%E1%BB%8B_tr%E1%BA%A5n_M%C3%A8o_V%E1%BA%A1c.jpg/960px-Th%E1%BB%8B_tr%E1%BA%A5n_M%C3%A8o_V%E1%BA%A1c.jpg"),
  "Lũng Cú": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/C%E1%BB%99t_c%E1%BB%9D_L%C5%A9ng_C%C3%BA.JPG/960px-C%E1%BB%99t_c%E1%BB%9D_L%C5%A9ng_C%C3%BA.JPG"),

  // ── Lào Cai ─────────────────────────────────────────────────────
  "Lào Cai": LOCAL_FANSIPAN,
  "Sa Pa": LOCAL_FANSIPAN,
  "Bắc Hà": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/M%C3%A8o_Ho%C3%A0ng_A_T%C6%B0%E1%BB%9Fng.jpg/960px-M%C3%A8o_Ho%C3%A0ng_A_T%C6%B0%E1%BB%9Fng.jpg"),
  "Mù Cang Chải": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Mu_Cang_Chai_Town_-_Yen_Bai_-_Vietnam.jpg/960px-Mu_Cang_Chai_Town_-_Yen_Bai_-_Vietnam.jpg"),
  "Yên Bái": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/M%E1%BB%99t_g%C3%B3c_TP.Y%C3%AAn_B%C3%A1i.JPG/960px-M%E1%BB%99t_g%C3%B3c_TP.Y%C3%AAn_B%C3%A1i.JPG"),

  // ── Thái Nguyên ─────────────────────────────────────────────────
  "Thái Nguyên": w("https://upload.wikimedia.org/wikipedia/commons/1/19/TN_VNG_QT.jpg"),
  "Hồ Núi Cốc": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Nui_Coc_Lake1.jpg/960px-Nui_Coc_Lake1.jpg"),
  "Tân Cương": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Tan_Cuong_Tea_culture.jpg/960px-Tan_Cuong_Tea_culture.jpg"),
  "Ba Bể": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Ba_Be_Lake_6464.jpg/960px-Ba_Be_Lake_6464.jpg"),
  "Bắc Kạn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Th%C3%A0nh_ph%E1%BB%91_B%E1%BA%AFc_K%E1%BA%A1n.jpg/960px-Th%C3%A0nh_ph%E1%BB%91_B%E1%BA%AFc_K%E1%BA%A1n.jpg"),

  // ── Phú Thọ ─────────────────────────────────────────────────────
  "Phú Thọ": w("https://upload.wikimedia.org/wikipedia/commons/2/21/%C4%90%C6%B0%E1%BB%9Dng_l%C3%AAn_%C4%90%E1%BB%81n_H%C3%B9ng_-_panoramio.jpg"),
  "Đền Hùng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Mausoleum_of_Hung_King.JPG/960px-Mausoleum_of_Hung_King.JPG"),
  "Tam Đảo": w("https://upload.wikimedia.org/wikipedia/commons/a/af/C%C3%A1nh_%C4%91%E1%BB%93ng_d%C6%B0%E1%BB%9Bi_ch%C3%A2n_n%C3%BAi_Tam_%C4%90%E1%BA%A3o.jpg"),
  "Mai Châu": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/Mai_Chau_-_H%C3%A4user_im_Reisfeld.jpg/960px-Mai_Chau_-_H%C3%A4user_im_Reisfeld.jpg"),
  "Hòa Bình": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/H%C3%B2a_B%C3%ACnh.JPG/960px-H%C3%B2a_B%C3%ACnh.JPG"),

  // ── Bắc Ninh ────────────────────────────────────────────────────
  "Bắc Ninh": w("https://upload.wikimedia.org/wikipedia/commons/8/87/Trung_t%C3%A2m_v%C4%83n_h%C3%B3a_Kinh_B%E1%BA%AFc.jpg"),
  "Đồng Kỵ": w("https://upload.wikimedia.org/wikipedia/commons/b/b2/%C4%90%E1%BB%93ng_K%E1%BB%B5_07.jpg"),
  "Tây Yên Tử": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/T%C3%A2y_Y%C3%AAn_T%E1%BB%AD.jpg/960px-T%C3%A2y_Y%C3%AAn_T%E1%BB%AD.jpg"),
  "Bắc Giang": w("https://upload.wikimedia.org/wikipedia/commons/0/04/%C4%90%C6%B0%E1%BB%9Dng_ph%E1%BB%91_th%C3%A0nh_ph%E1%BB%91_B%E1%BA%AFc_Giang.jpg"),
  "Chùa Bút Tháp": w("https://upload.wikimedia.org/wikipedia/commons/7/71/VN_But_Thap3_tango7174.jpg"),

  // ── Hưng Yên ────────────────────────────────────────────────────
  "Hưng Yên": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/The_grand_voyage_vinhomes_ocean_park_3.jpg/960px-The_grand_voyage_vinhomes_ocean_park_3.jpg"),
  "Phố Hiến": w("https://upload.wikimedia.org/wikipedia/commons/f/fd/Ph%C6%B0%E1%BB%9Dng_Ph%E1%BB%91_Hi%E1%BA%BFn.jpg"),
  "Văn Miếu Xích Đằng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/V%C4%83n_mi%E1%BA%BFu_X%C3%ADch_%C4%90%E1%BA%B1ng_02.JPG/960px-V%C4%83n_mi%E1%BA%BFu_X%C3%ADch_%C4%90%E1%BA%B1ng_02.JPG"),
  "Thái Bình": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Bao_tang_Thai_Binh.jpg/960px-Bao_tang_Thai_Binh.jpg"),

  // ── Ninh Bình ───────────────────────────────────────────────────
  "Ninh Bình": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0d/Co_do_Hoa_Lu_112.JPG/960px-Co_do_Hoa_Lu_112.JPG"),
  "Tràng An": w("https://upload.wikimedia.org/wikipedia/commons/0/08/Muaxuantamcoc.jpg"),
  "Tam Cốc": w("https://upload.wikimedia.org/wikipedia/commons/0/08/Muaxuantamcoc.jpg"),
  "Hoa Lư": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Codohoalu1-Model.jpg/960px-Codohoalu1-Model.jpg"),
  "Chùa Tam Chúc": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Tam_Chuc_Pagoda_-_Ha_Nam.jpg/960px-Tam_Chuc_Pagoda_-_Ha_Nam.jpg"),
  "Phủ Dầy": w("https://upload.wikimedia.org/wikipedia/commons/7/7d/LeHoiPhuDay.jpg"),

  // ── Quảng Trị ───────────────────────────────────────────────────
  "Quảng Trị": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Th%C3%A0nh_c%E1%BB%95_Qu%E1%BA%A3ng_Tr%E1%BB%8B_Foto.jpg/960px-Th%C3%A0nh_c%E1%BB%95_Qu%E1%BA%A3ng_Tr%E1%BB%8B_Foto.jpg"),
  "Phong Nha - Kẻ Bàng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Phongnhakebang6.jpg/960px-Phongnhakebang6.jpg"),
  "Thành cổ Quảng Trị": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Th%C3%A0nh_c%E1%BB%95_Qu%E1%BA%A3ng_Tr%E1%BB%8B_4.jpg/960px-Th%C3%A0nh_c%E1%BB%95_Qu%E1%BA%A3ng_Tr%E1%BB%8B_4.jpg"),
  "Cửa Tùng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Cua_Tung_Beach.jpg/960px-Cua_Tung_Beach.jpg"),

  // ── Quảng Ngãi ──────────────────────────────────────────────────
  "Quảng Ngãi": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/DUNG_QUAT_REFINERY_-_panoramio.jpg/960px-DUNG_QUAT_REFINERY_-_panoramio.jpg"),
  "Lý Sơn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/C%E1%BB%95ng_ch%C3%A0o_tr%C3%AAn_Huy%E1%BB%87n_%C4%90%E1%BA%A3o_L%C3%BD_S%C6%A1n_-_Qu%E1%BA%A3ng_Ng%C3%A3i.jpg/960px-C%E1%BB%95ng_ch%C3%A0o_tr%C3%AAn_Huy%E1%BB%87n_%C4%90%E1%BA%A3o_L%C3%BD_S%C6%A1n_-_Qu%E1%BA%A3ng_Ng%C3%A3i.jpg"),
  "Sa Huỳnh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/%C4%90%E1%BA%A7m_N%C6%B0%E1%BB%9Bc_M%E1%BA%B7n%2C_Sa_Hu%E1%BB%B3nh.jpg/960px-%C4%90%E1%BA%A7m_N%C6%B0%E1%BB%9Bc_M%E1%BA%B7n%2C_Sa_Hu%E1%BB%B3nh.jpg"),
  "Măng Đen": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Pa_S%C4%A9_Waterfall%2C_Mang_Den_Vietnam.jpg/960px-Pa_S%C4%A9_Waterfall%2C_Mang_Den_Vietnam.jpg"),
  "Kon Tum": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Kontum_wooden_catholic_church.jpg/960px-Kontum_wooden_catholic_church.jpg"),

  // ── Gia Lai ─────────────────────────────────────────────────────
  "Gia Lai": w("https://upload.wikimedia.org/wikipedia/commons/9/9c/Chi%E1%BB%81u_cao_nguy%C3%AAn_-_Late_afternoon_in_the_Central_High_Plateaux_-_panoramio.jpg"),
  "Quy Nhơn": w("https://upload.wikimedia.org/wikipedia/commons/8/8b/Nh%C3%A0_th%E1%BB%9D_ch%C3%ADnh_t%C3%B2a_Qui_Nh%C6%A1n.jpg"),
  "Biển Hồ": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Bi%E1%BB%83n_H%E1%BB%93%2C_TP_Pleiku%2C_Gia_Lai.jpg/960px-Bi%E1%BB%83n_H%E1%BB%93%2C_TP_Pleiku%2C_Gia_Lai.jpg"),
  "Kbang": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/K50_Waterfall_Kon_Chu_Rang_Nature_Reserve_Gia_Lai_Vietnam.png/960px-K50_Waterfall_Kon_Chu_Rang_Nature_Reserve_Gia_Lai_Vietnam.png"),
  "Tây Sơn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/NguyenHue.jpg/960px-NguyenHue.jpg"),

  // ── Khánh Hòa ───────────────────────────────────────────────────
  "Khánh Hòa": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/PonNagarChamTowers.jpg/960px-PonNagarChamTowers.jpg"),
  "Nha Trang": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg/960px-Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg"),
  "Vịnh Vĩnh Hy": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Vinh_hy_bay.jpg/960px-Vinh_hy_bay.jpg"),
  "Ninh Chữ": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Ninh_Chu_Beach_%28B%C3%A3i_bi%E1%BB%83n_ninh_ch%E1%BB%AF_Ninh_Thu%E1%BA%ADn_%29_-_panoramio.jpg/960px-Ninh_Chu_Beach_%28B%C3%A3i_bi%E1%BB%83n_ninh_ch%E1%BB%AF_Ninh_Thu%E1%BA%ADn_%29_-_panoramio.jpg"),
  "Đảo Bình Ba": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/B%C3%ACnh_Ba_Island.jpg/960px-B%C3%ACnh_Ba_Island.jpg"),

  // ── Lâm Đồng ────────────────────────────────────────────────────
  "Lâm Đồng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Da_Lat_-_Xuan_Huong_Lake.jpg/960px-Da_Lat_-_Xuan_Huong_Lake.jpg"),
  "Đà Lạt": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Da_Lat_-_Viet_Nam.jpg/960px-Da_Lat_-_Viet_Nam.jpg"),
  "Mũi Né": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/M%C5%A9i_N%C3%A9_Fishing_Village.jpg/960px-M%C5%A9i_N%C3%A9_Fishing_Village.jpg"),
  "Phan Thiết": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/S%C3%B4ng_C%C3%A0_Ty_trong_TP.Phan_Thi%E1%BA%BFt.JPG/960px-S%C3%B4ng_C%C3%A0_Ty_trong_TP.Phan_Thi%E1%BA%BFt.JPG"),
  "Đắk Nông": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Draysap01.JPG/960px-Draysap01.JPG"),

  // ── Đắk Lắk ─────────────────────────────────────────────────────
  "Đắk Lắk": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Lak_Lake.jpg/960px-Lak_Lake.jpg"),
  "Buôn Ma Thuột": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6c/Bmtcitycenter.png/960px-Bmtcitycenter.png"),
  "Gành Đá Đĩa": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/G%C3%A0nh_%C4%90%C3%A1_%C4%90%C4%A9a.jpg/960px-G%C3%A0nh_%C4%90%C3%A1_%C4%90%C4%A9a.jpg"),
  "Tuy Hòa": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/Tuy_Ho%C3%A0_beach%2C_Ph%C3%BA_Y%C3%AAn.jpg/960px-Tuy_Ho%C3%A0_beach%2C_Ph%C3%BA_Y%C3%AAn.jpg"),
  "Hồ Lắk": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Lak_Lake.jpg/960px-Lak_Lake.jpg"),

  // ── Đồng Nai ────────────────────────────────────────────────────
  "Đồng Nai": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Nh%C3%A0_th%E1%BB%9D_ch%C3%ADnh_V%C4%83n_mi%E1%BA%BFu_Tr%E1%BA%A5n_Bi%C3%AAn.jpg/960px-Nh%C3%A0_th%E1%BB%9D_ch%C3%ADnh_V%C4%83n_mi%E1%BA%BFu_Tr%E1%BA%A5n_Bi%C3%AAn.jpg"),
  "Biên Hòa": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Bien_Hoa_City_20.JPG/960px-Bien_Hoa_City_20.JPG"),
  "Nam Cát Tiên": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Cat_Tien_National_Park%2C_Vietnam.jpg/960px-Cat_Tien_National_Park%2C_Vietnam.jpg"),
  "Bình Phước": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/B%C3%ACnh_Ph%C6%B0%E1%BB%9Bc_landscape.jpg/960px-B%C3%ACnh_Ph%C6%B0%E1%BB%9Bc_landscape.jpg"),

  // ── Tây Ninh ────────────────────────────────────────────────────
  "Tây Ninh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Ho_dau_tieng.jpg/960px-Ho_dau_tieng.jpg"),
  "Núi Bà Đen": w("https://upload.wikimedia.org/wikipedia/commons/1/10/Qu%E1%BA%A7n_th%E1%BB%83_ch%C3%B9a_Th%C6%B0%E1%BB%A3ng_%E1%BB%9F_n%C3%BAi_B%C3%A0_%C4%90en.png"),
  "Tòa Thánh Cao Đài": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/T%C3%B2a_Th%C3%A1nh_T%C3%A2y_Ninh_042013.JPG/960px-T%C3%B2a_Th%C3%A1nh_T%C3%A2y_Ninh_042013.JPG"),
  "Long An": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Th%C3%A0nh_ph%E1%BB%91_T%C3%A2n_An.jpg/960px-Th%C3%A0nh_ph%E1%BB%91_T%C3%A2n_An.jpg"),
  "Đồng Tháp Mười": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/%C4%90%E1%BB%93ng_Th%C3%A1p_M%C6%B0%E1%BB%9Di_nh%C3%ACn_tr%C3%AAn_cao.jpg/960px-%C4%90%E1%BB%93ng_Th%C3%A1p_M%C6%B0%E1%BB%9Di_nh%C3%ACn_tr%C3%AAn_cao.jpg"),

  // ── Vĩnh Long ───────────────────────────────────────────────────
  "Vĩnh Long": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Trung_t%C3%A2m_H%C3%A0nh_ch%C3%ADnh_t%E1%BB%89nh_V%C4%A9nh_Long.jpg/960px-Trung_t%C3%A2m_H%C3%A0nh_ch%C3%ADnh_t%E1%BB%89nh_V%C4%A9nh_Long.jpg"),
  "Cù Lao An Bình": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Nh%C3%A0_Th%E1%BB%9D_%C4%90%E1%BB%93ng_Ph%C3%BA.jpg/960px-Nh%C3%A0_Th%E1%BB%9D_%C4%90%E1%BB%93ng_Ph%C3%BA.jpg"),
  "Bến Tre": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Ben_Tre_city.jpg/960px-Ben_Tre_city.jpg"),
  "Trà Vinh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/C%E1%BB%95ng_ch%C3%A0o_Tr%C3%A0_Vinh.jpg/960px-C%E1%BB%95ng_ch%C3%A0o_Tr%C3%A0_Vinh.jpg"),

  // ── Đồng Tháp ───────────────────────────────────────────────────
  "Đồng Tháp": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/C%E1%BA%A7u_Cao_L%C3%A3nh.jpg/960px-C%E1%BA%A7u_Cao_L%C3%A3nh.jpg"),
  "Tràm Chim": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/%C4%90%E1%BB%93ng_c%E1%BB%8F_v%C3%A0_chim_n%C6%B0%E1%BB%9Bc.jpg/960px-%C4%90%E1%BB%93ng_c%E1%BB%8F_v%C3%A0_chim_n%C6%B0%E1%BB%9Bc.jpg"),
  "Sa Đéc": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/S%C3%B4ng_Sa_%C4%90%C3%A9c.jpg/960px-S%C3%B4ng_Sa_%C4%90%C3%A9c.jpg"),
  "Mỹ Tho": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/M%E1%BB%B9_Tho_Gi%E1%BA%BFng_N%C6%B0%E1%BB%9Bc.jpg/960px-M%E1%BB%B9_Tho_Gi%E1%BA%BFng_N%C6%B0%E1%BB%9Bc.jpg"),
  "Cái Bè": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Vietnam_08_-_118_-_Cai_Be_on_the_water_%283185052919%29.jpg/960px-Vietnam_08_-_118_-_Cai_Be_on_the_water_%283185052919%29.jpg"),

  // ── Cà Mau ──────────────────────────────────────────────────────
  "Cà Mau": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Muicamau.jpg/960px-Muicamau.jpg"),
  "Mũi Cà Mau": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Tuongdaimuicamau.jpg/960px-Tuongdaimuicamau.jpg"),
  "U Minh Hạ": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/Chu%E1%BB%91i_t%E1%BA%A1i_r%E1%BB%ABng_U_Minh_h%E1%BA%A1.jpg/960px-Chu%E1%BB%91i_t%E1%BA%A1i_r%E1%BB%ABng_U_Minh_h%E1%BA%A1.jpg"),
  "Bạc Liêu": w("https://upload.wikimedia.org/wikipedia/commons/0/02/Nh%C3%A0_C%C3%B4ng_t%E1%BB%AD_B%E1%BA%A1c_Li%C3%AAu.jpg"),

  // ── An Giang ────────────────────────────────────────────────────
  "An Giang": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Mi%E1%BA%BFu_B%C3%A0_Ch%C3%BAa_X%E1%BB%A9_N%C3%BAi_Sam.jpg/960px-Mi%E1%BA%BFu_B%C3%A0_Ch%C3%BAa_X%E1%BB%A9_N%C3%BAi_Sam.jpg"),
  "Phú Quốc": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Phu_Quoc%2C_Viet_Nam.jpg/960px-Phu_Quoc%2C_Viet_Nam.jpg"),
  "Núi Sam - Châu Đốc": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Nh%C3%A0_ngh%E1%BB%89_tr%C3%AAn_N%C3%BAi_Sam%2C_th%C3%A0nh_ph%E1%BB%91_Ch%C3%A2u_%C4%90%E1%BB%91c.jpg/960px-Nh%C3%A0_ngh%E1%BB%89_tr%C3%AAn_N%C3%BAi_Sam%2C_th%C3%A0nh_ph%E1%BB%91_Ch%C3%A2u_%C4%90%E1%BB%91c.jpg"),
  "Hà Tiên": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/M%E1%BB%99t_g%E1%BB%91c_TRUNG_T%C3%82M_TH%C6%AF%C6%A0NG_M%E1%BA%A0I_th%C3%A0nh_ph%E1%BB%91_H%C3%80_TI%C3%8AN.jpg/960px-M%E1%BB%99t_g%E1%BB%91c_TRUNG_T%C3%82M_TH%C6%AF%C6%A0NG_M%E1%BA%A0I_th%C3%A0nh_ph%E1%BB%91_H%C3%80_TI%C3%8AN.jpg"),
  "Rừng Tràm Trà Sư": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/Tr%C3%A0_S%C6%B0_1.jpg/960px-Tr%C3%A0_S%C6%B0_1.jpg"),

  // ── Cao Bằng ────────────────────────────────────────────────────
  "Cao Bằng": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Ban_Gioc_-_Detian_Falls2.jpg/960px-Ban_Gioc_-_Detian_Falls2.jpg"),
  "Thác Bản Giốc": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Bangioc9tam.jpg/960px-Bangioc9tam.jpg"),
  "Động Ngườm Ngao": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/%C4%90%E1%BB%99ng_Ng%C6%B0%E1%BB%9Dm_Ngao.jpg/960px-%C4%90%E1%BB%99ng_Ng%C6%B0%E1%BB%9Dm_Ngao.jpg"),

  // ── Lai Châu ────────────────────────────────────────────────────
  "Lai Châu": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Laichautown.jpg/960px-Laichautown.jpg"),
  "Cầu Kính Rồng Mây": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/O_Quy_Ho_pass.jpg/960px-O_Quy_Ho_pass.jpg"),
  "Pu Ta Leng": w("https://upload.wikimedia.org/wikipedia/commons/1/1d/Putaleng_summit.jpg"),

  // ── Điện Biên ───────────────────────────────────────────────────
  "Điện Biên": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/M%C6%B0%E1%BB%9Dng_Thanh_Valley.jpg/960px-M%C6%B0%E1%BB%9Dng_Thanh_Valley.jpg"),
  "Điện Biên Phủ": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/The_Victory_Monument_of_Dien_Bien_Phu_%28front%29_v2.jpg/960px-The_Victory_Monument_of_Dien_Bien_Phu_%28front%29_v2.jpg"),

  // ── Sơn La ──────────────────────────────────────────────────────
  "Sơn La": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/S%E1%BB%91ng_l%C6%B0ng_kh%E1%BB%A7ng_long_T%C3%A0_X%C3%B9a.jpg/960px-S%E1%BB%91ng_l%C6%B0ng_kh%E1%BB%A7ng_long_T%C3%A0_X%C3%B9a.jpg"),
  "Mộc Châu": w("https://upload.wikimedia.org/wikipedia/commons/e/e9/Thacdaiyem.jpg"),
  "Sông Đà": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/HoaBinh_Dam_-_Vietnam.JPG/960px-HoaBinh_Dam_-_Vietnam.JPG"),

  // ── Lạng Sơn ────────────────────────────────────────────────────
  "Lạng Sơn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/M%E1%BA%ABu_S%C6%A1n.jpg/960px-M%E1%BA%ABu_S%C6%A1n.jpg"),
  "Động Tam Thanh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Ch%C3%B9a_Tam_Thanh.jpg/960px-Ch%C3%B9a_Tam_Thanh.jpg"),
  "Chợ Đông Kinh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d6/Ch%E1%BB%A3_%C4%90%C3%B4ng_Kinh.jpg/960px-Ch%E1%BB%A3_%C4%90%C3%B4ng_Kinh.jpg"),
  "Mẫu Sơn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Mau_Son.JPG/960px-Mau_Son.JPG"),

  // ── Quảng Ninh ──────────────────────────────────────────────────
  "Quảng Ninh": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/A_view_of_Ha_Long_Bay_from_the_high_point_of_Sun_Sot_cave_%2831520203451%29.jpg/960px-A_view_of_Ha_Long_Bay_from_the_high_point_of_Sun_Sot_cave_%2831520203451%29.jpg"),
  "Hạ Long": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Ha_Long_2019_taken_by_DJI_FC220.jpg/960px-Ha_Long_2019_taken_by_DJI_FC220.jpg"),
  "Cô Tô": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/%C3%82u_c%E1%BA%A3ng.jpg/960px-%C3%82u_c%E1%BA%A3ng.jpg"),
  "Móng Cái": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Mong_Cai.jpg/960px-Mong_Cai.jpg"),
  "Vân Đồn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/S%C6%A1n_H%C3%A0o_Beach%2C_Cao_L%C3%B4n_Island%2C_V%C3%A2n_%C4%90%E1%BB%93n%2C_Qu%E1%BA%A3ng_Ninh%2C_Vi%E1%BB%87t_Nam.jpg/960px-S%C6%A1n_H%C3%A0o_Beach%2C_Cao_L%C3%B4n_Island%2C_V%C3%A2n_%C4%90%E1%BB%93n%2C_Qu%E1%BA%A3ng_Ninh%2C_Vi%E1%BB%87t_Nam.jpg"),
  "Yên Tử": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/N%C3%BAi_Y%C3%AAn_T%E1%BB%AD.jpg/960px-N%C3%BAi_Y%C3%AAn_T%E1%BB%AD.jpg"),

  // ── Thanh Hóa ───────────────────────────────────────────────────
  "Thanh Hóa": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Le_Loi_statue.JPG/960px-Le_Loi_statue.JPG"),
  "Sầm Sơn": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Sam_Son_beach.jpg/960px-Sam_Son_beach.jpg"),
  "Thành Nhà Hồ": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/C%E1%BB%95ng_Nam.jpg/960px-C%E1%BB%95ng_Nam.jpg"),
  "Pù Luông": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Ru%E1%BB%99ng_b%E1%BA%ADc_thang_P%C3%B9_Lu%C3%B4ng_1_-_NKS.jpg/960px-Ru%E1%BB%99ng_b%E1%BA%ADc_thang_P%C3%B9_Lu%C3%B4ng_1_-_NKS.jpg"),

  // ── Nghệ An ─────────────────────────────────────────────────────
  "Nghệ An": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Quangtruonghochiminh.jpg/960px-Quangtruonghochiminh.jpg"),
  "Cửa Lò": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Cualovedem.jpg/960px-Cualovedem.jpg"),
  "Kim Liên": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Kim_Lien_Monuments_Park.JPG/960px-Kim_Lien_Monuments_Park.JPG"),
  "Vinh": w("https://upload.wikimedia.org/wikipedia/vi/4/44/Th%C3%A0nh_ph%E1%BB%91_Vinh.jpg"),

  // ── Hà Tĩnh ─────────────────────────────────────────────────────
  "Hà Tĩnh": w("https://upload.wikimedia.org/wikipedia/commons/3/3f/Toancanhthixa.jpg"),
  "Thiên Cầm": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Thiencam4.jpg/960px-Thiencam4.jpg"),
  "Chùa Hương Tích": w("https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Ch%C3%B9a_H%C6%B0%C6%A1ng_T%C3%ADch%2C_H%C3%A0_T%C4%A9nh.JPG/960px-Ch%C3%B9a_H%C6%B0%C6%A1ng_T%C3%ADch%2C_H%C3%A0_T%C4%A9nh.JPG"),
};

const DEFAULT_REGION_IMAGE: RegionImageSource = LOCAL_HO_GUOM;

function lookup(name: string): RegionImageSource | undefined {
  if (REGION_IMAGES[name]) return REGION_IMAGES[name];
  // "Thủ Đức, Hồ Chí Minh" → try "Thủ Đức", then "Hồ Chí Minh".
  for (const part of name.split(",")) {
    const hit = REGION_IMAGES[part.trim()];
    if (hit) return hit;
  }
  return undefined;
}

/** Looks up a photo for a province or highlight name; falls back to a
 *  generic default when the place isn't in the curated set.
 *  Pass a more specific name first (e.g. highlight), then a broader
 *  fallback (e.g. its province) — the first match wins. */
export function getRegionImage(
  ...names: Array<string | null | undefined>
): RegionImageSource {
  for (const name of names) {
    const hit = name ? lookup(name) : undefined;
    if (hit) return hit;
  }
  return DEFAULT_REGION_IMAGE;
}

/** True when the area has its own photo (not just the province fallback). */
export function hasRegionImage(name: string): boolean {
  return !!REGION_IMAGES[name];
}
