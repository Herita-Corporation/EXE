import { Linking } from "react-native";
import { useToast } from "@/context/ToastContext";
import { isPartnerOfferActive } from "@/data/partnerOffers";
import { useLocale } from "@/i18n/LocaleContext";

export function usePartnerOfferLink() {
  const { showToast } = useToast();
  const { t } = useLocale();

  return async function openPartnerOffer(offer: { redemptionUrl: string; expiresOn?: string }) {
    if (!isPartnerOfferActive(offer)) {
      showToast(t("partnerOffer.expired"), "info");
      return;
    }

    try {
      if (new URL(offer.redemptionUrl).protocol !== "https:") throw new Error("Invalid offer URL");
      await Linking.openURL(offer.redemptionUrl);
    } catch {
      showToast(t("partnerOffer.openFailed"), "error");
    }
  };
}
