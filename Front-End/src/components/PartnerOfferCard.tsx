import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { PartnerLogoMark } from "@/components/PartnerLogoMark";
import { VoucherTicket } from "@/components/VoucherTicket";
import type { PartnerOffer } from "@/data/partnerOffers";
import { usePartnerOfferLink } from "@/hooks/usePartnerOfferLink";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

export function PartnerOfferCard({ offer, compact = false }: { offer: PartnerOffer; compact?: boolean }) {
  const { locale, t } = useLocale();
  const openPartnerOffer = usePartnerOfferLink();
  const benefit = offer.benefit[locale];
  const expired = offer.expired === true;
  const openVoucher = () => router.push({
    pathname: "/partner-voucher",
    params: { partner: offer.partnerId },
  });

  if (!compact) {
    return (
      <VoucherTicket
        logo={<PartnerLogoMark source={offer.logo} />}
        title={offer.name}
        benefit={benefit}
        meta={t(expired ? "partnerOffer.expired" : "partnerOffer.onWebsite")}
        redeemLabel={t(expired ? "partnerOffer.viewVoucher" : "partnerOffer.bookOnBooking")}
        redeemIcon={expired ? "chevron-forward" : "open-outline"}
        onOpen={openVoucher}
        onRedeem={expired ? openVoucher : () => openPartnerOffer({ redemptionUrl: offer.redemptionUrl })}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${t("partnerOffer.destinationSuggestion")}. ${offer.name}. ${offer.address}`}
      onPress={openVoucher}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card>
        <View style={styles.summary}>
          <PartnerLogoMark source={offer.logo} />
          <View style={styles.summaryCopy}>
            <Text style={styles.context}>{t("partnerOffer.destinationSuggestion")}</Text>
            <Text style={styles.name}>{offer.name}</Text>
            <Text style={styles.address}>{offer.address}</Text>
            {!expired && <Text style={styles.benefit}>{benefit}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.navy} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82 },
  summary: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  summaryCopy: { flex: 1, gap: 2 },
  context: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  name: { color: colors.navy, fontSize: 16, fontWeight: "800" },
  address: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  benefit: { color: colors.navy, fontSize: 13, lineHeight: 18, fontWeight: "700" },
});
