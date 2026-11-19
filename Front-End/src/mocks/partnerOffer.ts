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
  pointsCost: number;
  image: ImageSource | number;
  logo: ImageSource | number;
}

export const FEATURED_PARTNER_OFFER: PartnerOffer = {
  partnerId: "vinpearl",
  name: "Vinpearl",
  category: "Hotels",
  campaign: {
    vi: {
      title: "Thức dậy bên biển",
      benefit: "Tặng bữa sáng cho 2 khách",
      terms: "Áp dụng khi đặt gói nghỉ dưỡng cho 2 khách ở cùng phòng.",
    },
    en: {
      title: "Wake up by the sea",
      benefit: "Breakfast for two included",
      terms: "Applies to a resort package for two guests sharing a room.",
    },
  },
  pointsCost: 600,
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
        title: "Hai đêm khám phá phố",
        benefit: "Giảm 200.000₫",
        terms: "Áp dụng vào giá phòng khi đặt từ 2 đêm liên tiếp tại cùng khách sạn.",
      },
      en: {
        title: "Two nights in town",
        benefit: "Save ₫200,000",
        terms: "Applies to the room rate when booking at least two consecutive nights at the same hotel.",
      },
    },
    pointsCost: 500,
    image: require("@/assets/images/partners/muong-thanh-cover.jpg"),
    logo: require("@/assets/images/partners/muong-thanh-logo.png"),
  },
  {
    partnerId: "all-accor",
    name: "ALL Accor",
    category: "Hotels",
    campaign: {
      vi: {
        title: "Ngủ nướng cuối tuần",
        benefit: "Trả phòng tới 15h",
        terms: "Áp dụng cho kỳ nghỉ cuối tuần, tùy tình trạng phòng tại thời điểm nhận phòng.",
      },
      en: {
        title: "Sleep in this weekend",
        benefit: "3 p.m. checkout",
        terms: "Applies to weekend stays, subject to availability at check-in.",
      },
    },
    pointsCost: 800,
    image: require("@/assets/images/partners/all-accor-cover.jpg"),
    logo: require("@/assets/images/partners/all-accor-logo.png"),
  },
  {
    partnerId: "pizza-4ps",
    name: "Pizza 4P’s",
    category: "Dining",
    campaign: {
      vi: {
        title: "Hẹn nhau ăn pizza",
        benefit: "Tặng 1 phần burrata",
        terms: "Áp dụng khi dùng tại nhà hàng và gọi từ 2 bánh pizza.",
      },
      en: {
        title: "Let’s get pizza",
        benefit: "Free burrata",
        terms: "Dine in and order at least two pizzas to receive one serving of burrata.",
      },
    },
    pointsCost: 400,
    image: require("@/assets/images/partners/pizza-4ps-cover.jpg"),
    logo: require("@/assets/images/partners/pizza-4ps-logo.png"),
  },
  {
    partnerId: "gogi-house",
    name: "GoGi House",
    category: "Dining",
    campaign: {
      vi: {
        title: "Rủ hội bạn đi nướng",
        benefit: "Đi 4, trả tiền 3",
        terms: "Áp dụng cho nhóm 4 người lớn cùng chọn một hạng buffet.",
      },
      en: {
        title: "BBQ with the crew",
        benefit: "Four dine, three pay",
        terms: "Applies to four adults ordering the same buffet tier.",
      },
    },
    pointsCost: 450,
    image: require("@/assets/images/partners/gogi-house-cover.jpg"),
    logo: require("@/assets/images/partners/gogi-house-logo.png"),
  },
];
