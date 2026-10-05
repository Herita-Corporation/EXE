// Real landmark photos (same bundle as src/mocks/featuredMissions.ts — see
// its header comment for licensing/attribution) reused here as the region
// picker's and itinerary activity cards' imagery, replacing the old
// picsum.photos placeholders. Keyed by exact province OR highlight name
// (src/data/vietnamProvinces.ts) — falls back to a generic default for any
// place not in this small curated set (AI-Itinerary can generate a trip to
// any city, far more than we have real photos for).
// require() resolves to a numeric asset module id at bundle time.
type LocalImage = number;

const HO_GUOM: LocalImage = require("@/assets/images/missions/ho-guom.jpg");
const HOI_AN: LocalImage = require("@/assets/images/missions/hoi-an-den-hoa-dang.jpg");
const CAU_VANG: LocalImage = require("@/assets/images/missions/cau-vang.jpg");
const CHO_NOI_CAI_RANG: LocalImage = require("@/assets/images/missions/cho-noi-cai-rang.jpg");
const FANSIPAN: LocalImage = require("@/assets/images/missions/fansipan.jpg");

const REGION_IMAGES: Record<string, LocalImage> = {
  "Hà Nội": HO_GUOM,
  "Hoàn Kiếm": HO_GUOM,
  "Hội An": HOI_AN,
  "Đà Nẵng": CAU_VANG,
  "Cần Thơ": CHO_NOI_CAI_RANG,
  "Cái Răng": CHO_NOI_CAI_RANG,
  "Lào Cai": FANSIPAN,
  "Sa Pa": FANSIPAN,
};

const DEFAULT_REGION_IMAGE = HO_GUOM;

/** Looks up a real photo for a province or highlight name; falls back to a
 * generic default when the place isn't in the curated set. Pass a more
 * specific name first (e.g. highlight), then a broader fallback (e.g. its
 * province) — the first match wins. */
export function getRegionImage(...names: Array<string | null | undefined>): LocalImage {
  for (const name of names) {
    if (name && REGION_IMAGES[name]) return REGION_IMAGES[name];
  }
  return DEFAULT_REGION_IMAGE;
}
