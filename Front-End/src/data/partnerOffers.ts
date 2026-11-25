import type { ImageSource } from "expo-image";
import type { Locale } from "@/i18n/LocaleContext";

export const PARTNER_CATEGORY_LABELS = {
  Hotels: "voucher.filterHotels",
  Dining: "voucher.filterDining",
} as const;

type PartnerVoucher =
  | { redemptionUrl: `https://${string}`; soldOut?: false }
  | { soldOut: true; redemptionUrl?: never };

export type PartnerOffer = PartnerVoucher & {
  partnerId: string;
  name: string;
  address: string;
  destinations: readonly string[];
  category: keyof typeof PARTNER_CATEGORY_LABELS;
  benefit: Record<Locale, string>;
  image: ImageSource | number;
  logo: ImageSource | number;
};

export function isPartnerOfferActive(offer: { soldOut?: boolean; expiresOn?: string }): boolean {
  // Published end dates are inclusive in Vietnam time.
  return !offer.soldOut && (!offer.expiresOn || Date.now() <= Date.parse(`${offer.expiresOn}T23:59:59.999+07:00`));
}

export const PARTNER_OFFERS: readonly PartnerOffer[] = [
  {
    partnerId: "emerald-phu-quoc",
    name: "Emerald Boutique Hotel Phú Quốc",
    address: "S09-10/SS24 Sonasea Villas và Resort, ấp Đường Bào, đặc khu Phú Quốc, An Giang 92513, Việt Nam",
    destinations: ["An Giang", "Phú Quốc", "Kiên Giang"],
    category: "Hotels",
    benefit: {
      vi: "Giảm 10% khi đặt trên Booking.com bằng điện thoại",
      en: "10% off when you book on Booking.com on your phone",
    },
    redemptionUrl: "https://www.booking.com/hotel/vn/emerald-boutique-phu-quoc.html",
    image: require("@/assets/images/partners/emerald-phu-quoc-cover.jpg"),
    logo: require("@/assets/images/partners/emerald-phu-quoc-logo.png"),
  },
  {
    partnerId: "lat-valley-villa",
    name: "Lat Valley Villa",
    address: "02 Đường Khởi Nghĩa Bắc Sơn, Xuân Hương - Đà Lạt, Lâm Đồng 670000, Việt Nam",
    destinations: ["Lâm Đồng", "Đà Lạt"],
    category: "Hotels",
    benefit: {
      vi: "Giảm 10% và tặng buffet sáng",
      en: "10% off with buffet breakfast included",
    },
    soldOut: true,
    image: require("@/assets/images/partners/lat-valley-villa-cover.jpg"),
    logo: require("@/assets/images/partners/lat-valley-villa-logo.png"),
  },
  {
    partnerId: "sus-house-coffee",
    name: "Su's House Coffee",
    address: "CT31 Đ. Tam Đảo, Cư xá Bắc Hải, Hòa Hưng, Hồ Chí Minh, Việt Nam",
    destinations: ["Hồ Chí Minh", "HCM", "TPHCM", "Sài Gòn", "Hòa Hưng"],
    category: "Dining",
    benefit: {
      vi: "Giảm 10% trên tổng hóa đơn",
      en: "10% off the total bill",
    },
    soldOut: true,
    image: require("@/assets/images/partners/sus-house-coffee-cover.jpg"),
    logo: require("@/assets/images/partners/sus-house-coffee-logo.png"),
  },
];

function normalizeDestination(destination: string) {
  return destination.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getDestinationPartnerOffers(destinations: readonly string[]): PartnerOffer[] {
  const locations = destinations.map((destination) => ` ${normalizeDestination(destination)} `);
  return PARTNER_OFFERS.filter((offer) => offer.destinations.some((destination) => {
    const name = ` ${normalizeDestination(destination)} `;
    return locations.some((location) => location.includes(name));
  }));
}
