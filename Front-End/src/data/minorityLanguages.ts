export interface MinorityLanguage {
  code: string;
  name: string;
  region: string;
}

// Vietnam's largest ethnic-minority language communities by population —
// static list for now; the eventual translation backend will drive which
// ones are actually supported.
export const MINORITY_LANGUAGES: MinorityLanguage[] = [
  { code: "tay", name: "Tày", region: "Đông Bắc Bộ" },
  { code: "thai", name: "Thái", region: "Tây Bắc Bộ" },
  { code: "muong", name: "Mường", region: "Hòa Bình, Thanh Hóa" },
  { code: "hmong", name: "H'Mông", region: "Tây Bắc Bộ" },
  { code: "khmer", name: "Khmer", region: "Đồng bằng sông Cửu Long" },
  { code: "ede", name: "Ê Đê", region: "Tây Nguyên" },
  { code: "jarai", name: "Gia Rai", region: "Tây Nguyên" },
  { code: "bana", name: "Ba Na", region: "Tây Nguyên" },
  { code: "koho", name: "Cơ Ho", region: "Lâm Đồng" },
  { code: "cham", name: "Chăm", region: "Nam Trung Bộ" },
];
