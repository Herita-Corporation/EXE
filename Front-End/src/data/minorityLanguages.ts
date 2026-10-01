export interface MinorityLanguage {
  code: string;
  name: string;
  region: string;
}

// Only languages that have usable (licence-cleared) parallel data with Vietnamese:
// Ba Na is live; Gia Rai and Khmer have data and models in training (shown as "coming soon").
// Removed 01/10/2026 — no usable dataset: Tày, Thái, Mường, H'Mông, Ê Đê (CC BY-NC only), Cơ Ho, Chăm.
export const MINORITY_LANGUAGES: MinorityLanguage[] = [
  { code: "bana", name: "Ba Na", region: "Tây Nguyên" },
  { code: "jarai", name: "Gia Rai", region: "Tây Nguyên" },
  { code: "khmer", name: "Khmer", region: "Đồng bằng sông Cửu Long" },
];
