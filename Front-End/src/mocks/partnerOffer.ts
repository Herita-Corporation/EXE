import type { Ionicons } from "@expo/vector-icons";
import type { ImageSource } from "expo-image";

export const PARTNER_CATEGORY_COPY = {
  Hotels: {
    label: "voucher.filterHotels",
    headline: "partnerOffer.roomDiscount",
    terms: "partnerOffer.bookingTerms",
  },
  Dining: {
    label: "voucher.filterDining",
    headline: "partnerOffer.diningDiscount",
    terms: "partnerOffer.diningTerms",
  },
} as const;

export interface PartnerOffer {
  partnerId: string;
  name: string;
  category: keyof typeof PARTNER_CATEGORY_COPY;
  discountPercent: number;
  pointsCost: number;
  image: ImageSource | number;
  logo: {
    wordmark: string;
    descriptor: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    cornerRatio: number;
  };
}

export const VINH_LAM_OFFER: PartnerOffer = {
  partnerId: "vinh-lam-hotel",
  name: "Vịnh Lam Hotel",
  category: "Hotels",
  discountPercent: 15,
  pointsCost: 600,
  image: require("@/assets/images/partner-hotel-demo.jpg"),
  logo: {
    wordmark: "Vịnh Lam",
    descriptor: "Hotel",
    icon: "water-outline",
    color: "#176761",
    cornerRatio: 0.5,
  },
};

export const PARTNER_OFFERS: readonly PartnerOffer[] = [
  VINH_LAM_OFFER,
  {
    partnerId: "bep-tram-muoi",
    name: "Bếp Trầm & Muối",
    category: "Dining",
    discountPercent: 10,
    pointsCost: 400,
    image: require("@/assets/images/tram-muoi-cover.jpg"),
    logo: {
      wordmark: "Trầm & Muối",
      descriptor: "Bếp Việt",
      icon: "flame",
      color: "#A54B2C",
      cornerRatio: 0.24,
    },
  },
  {
    partnerId: "may-tang-retreat",
    name: "Mây Tầng Retreat",
    category: "Hotels",
    discountPercent: 20,
    pointsCost: 800,
    image: require("@/assets/images/may-tang-cover.jpg"),
    logo: {
      wordmark: "Mây Tầng",
      descriptor: "Retreat",
      icon: "cloud-outline",
      color: "#59468E",
      cornerRatio: 0.36,
    },
  },
];
