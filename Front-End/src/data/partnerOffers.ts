import type { ImageSource } from "expo-image";
import type { Locale } from "@/i18n/LocaleContext";

export const PARTNER_CATEGORY_LABELS = {
  Hotels: "voucher.filterHotels",
  Dining: "voucher.filterDining",
} as const;

interface CampaignCopy {
  title: string;
  benefit: string;
  terms: string;
}

export interface PartnerOffer {
  partnerId: string;
  name: string;
  category: keyof typeof PARTNER_CATEGORY_LABELS;
  campaign: Record<Locale, CampaignCopy>;
  redemptionUrl: `https://${string}`;
  expiresOn?: string;
  image: ImageSource | number;
  logo: ImageSource | number;
}

export function isPartnerOfferActive(offer: Pick<PartnerOffer, "expiresOn">): boolean {
  // Published end dates are inclusive in Vietnam time.
  return !offer.expiresOn || Date.now() <= Date.parse(`${offer.expiresOn}T23:59:59.999+07:00`);
}

export const FEATURED_PARTNER_OFFER: PartnerOffer = {
  partnerId: "vinpearl",
  name: "Vinpearl",
  category: "Hotels",
  campaign: {
    vi: {
      title: "Combo Ocean Symphony Nha Trang",
      benefit: "Gói 3N2Đ hoặc 4N3Đ kèm bữa tối",
      terms: "Chọn giá Ocean Symphony khi đặt tại Vinpearl Resort Nha Trang hoặc Vinpearl Resort & Spa Nha Trang Bay. Gói có buffet sáng và một bữa tối cho 2 khách người lớn mỗi phòng.",
    },
    en: {
      title: "Ocean Symphony in Nha Trang",
      benefit: "A 2- or 3-night stay with dinner",
      terms: "Select the Ocean Symphony rate at Vinpearl Resort Nha Trang or Vinpearl Resort & Spa Nha Trang Bay. The package includes breakfast and one dinner for two adults per room.",
    },
  },
  redemptionUrl: "https://vinpearl.com/vi/uu-dai-combo-ocean-symphony-nha-trang",
  expiresOn: "2026-12-31",
  image: require("@/assets/images/partners/vinpearl-cover.jpg"),
  logo: require("@/assets/images/partners/vinpearl-logo.png"),
};

export const PARTNER_OFFERS: readonly PartnerOffer[] = [
  FEATURED_PARTNER_OFFER,
  {
    partnerId: "muong-thanh",
    name: "Mường Thanh",
    category: "Hotels",
    campaign: {
      vi: {
        title: "Voucher Deluxe Mường Thanh Mộc Châu",
        benefit: "Phòng Deluxe King/Twin kèm bữa sáng cho 2 khách",
        terms: "Áp dụng tại Mường Thanh Holiday Mộc Châu. Liên hệ LifeLink từ trang voucher để xác nhận phòng trống và phụ thu theo ngày trước khi mua.",
      },
      en: {
        title: "Muong Thanh Moc Chau Deluxe voucher",
        benefit: "Deluxe King or Twin room with breakfast for two",
        terms: "Valid at Muong Thanh Holiday Moc Chau. Contact LifeLink from the voucher page to confirm room availability and any surcharges for your dates before purchasing.",
      },
    },
    redemptionUrl: "https://www.lifelink.vn/e-voucher/moc-chau-muong-thanh-moc-chau-4-sao-nghi-duong-phong-deluxe-king-hoac-twin-p153096",
    image: require("@/assets/images/partners/muong-thanh-cover.jpg"),
    logo: require("@/assets/images/partners/muong-thanh-logo.png"),
  },
  {
    partnerId: "all-accor",
    name: "ALL Accor",
    category: "Hotels",
    campaign: {
      vi: {
        title: "Festive Escape tại Pullman Saigon Centre",
        benefit: "2 đêm cho 2 khách · 10.000 điểm ALL Accor",
        terms: "Dành cho hội viên ALL Accor đã nhận email mời đổi điểm. Phòng Superior kèm buffet sáng, lưu trú từ 31/12/2026 đến 02/01/2027. Accor gửi voucher qua email sau khi xác nhận người sử dụng.",
      },
      en: {
        title: "Festive Escape at Pullman Saigon Centre",
        benefit: "2 nights for 2 guests · 10,000 ALL Accor points",
        terms: "For ALL Accor members who received a redemption invitation by email. Stay in a Superior Room with breakfast from December 31, 2026 to January 2, 2027. Accor emails the voucher after confirming the recipient.",
      },
    },
    redemptionUrl: "https://limitlessexperiences.accor.com/vn-psaigon-stay1",
    expiresOn: "2027-01-02",
    image: require("@/assets/images/partners/all-accor-cover.jpg"),
    logo: require("@/assets/images/partners/all-accor-logo.png"),
  },
  {
    partnerId: "pizza-4ps",
    name: "Pizza 4P’s",
    category: "Dining",
    campaign: {
      vi: {
        title: "Phiếu quà tặng Pizza 4P’s",
        benefit: "eVoucher mệnh giá 200.000₫",
        terms: "Mua qua Giftpop. Phiếu có hạn 180 ngày từ ngày mua, dùng một lần tại nhà hàng hoặc khi đặt món qua website Pizza 4P’s theo điều kiện áp dụng.",
      },
      en: {
        title: "Pizza 4P’s gift voucher",
        benefit: "₫200,000 eVoucher",
        terms: "Purchase on Giftpop. The voucher is valid for 180 days from purchase and can be used once in a restaurant or when ordering on the Pizza 4P’s website, subject to the voucher terms.",
      },
    },
    redemptionUrl: "https://www.giftpop.vn/san-pham/phieu-qua-tang-pizza-4p-s-200k-mp2205300002",
    image: require("@/assets/images/partners/pizza-4ps-cover.jpg"),
    logo: require("@/assets/images/partners/pizza-4ps-logo.png"),
  },
  {
    partnerId: "gogi-house",
    name: "GoGi House",
    category: "Dining",
    campaign: {
      vi: {
        title: "Phiếu quà tặng GoGi House",
        benefit: "eVoucher mệnh giá 200.000₫",
        terms: "Mua qua Giftpop. Phiếu có hạn 90 ngày từ ngày mua. Xuất trình eVoucher có QR hoặc mã vạch tại nhà hàng áp dụng.",
      },
      en: {
        title: "GoGi House gift voucher",
        benefit: "₫200,000 eVoucher",
        terms: "Purchase on Giftpop. The voucher is valid for 90 days from purchase. Present its QR code or barcode at a participating restaurant.",
      },
    },
    redemptionUrl: "https://www.giftpop.vn/san-pham/phieu-qua-tang-gogi-house-200k-mp1905280011",
    image: require("@/assets/images/partners/gogi-house-cover.jpg"),
    logo: require("@/assets/images/partners/gogi-house-logo.png"),
  },
];
