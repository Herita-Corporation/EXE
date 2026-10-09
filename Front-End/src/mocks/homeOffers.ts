// Demo "Special Offers" carousel on Home — static showcase content, always
// shown regardless of what the voucher backend returns. Copy lives in i18n
// (homeOffers.*) so it follows the app language; brand names stay as-is.
import type { Ionicons } from "@expo/vector-icons";
import type { TranslationKey } from "@/i18n/LocaleContext";

export interface HomeOffer {
  id: string;
  /** Matches a voucher category so the tile uses the Voucher tab's colors. */
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: TranslationKey;
  locationKey: TranslationKey;
  offerKey: TranslationKey;
}

export const HOME_OFFERS: HomeOffer[] = [
  {
    id: "offer-1",
    category: "Dining",
    icon: "cafe",
    titleKey: "homeOffers.coffeeTitle",
    locationKey: "homeOffers.coffeeLocation",
    offerKey: "homeOffers.coffeeOffer",
  },
  {
    id: "offer-2",
    category: "Hotels",
    icon: "bed",
    titleKey: "homeOffers.hotelTitle",
    locationKey: "homeOffers.hotelLocation",
    offerKey: "homeOffers.hotelOffer",
  },
  {
    id: "offer-3",
    category: "Travel",
    icon: "airplane",
    titleKey: "homeOffers.loungeTitle",
    locationKey: "homeOffers.loungeLocation",
    offerKey: "homeOffers.loungeOffer",
  },
];
