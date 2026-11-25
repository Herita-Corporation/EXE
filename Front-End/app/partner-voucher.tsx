import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "@/components/BackHeader";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PartnerLogoMark } from "@/components/PartnerLogoMark";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionHeader } from "@/components/SectionHeader";
import { PARTNER_CATEGORY_LABELS, PARTNER_OFFERS } from "@/data/partnerOffers";
import { usePartnerOfferLink } from "@/hooks/usePartnerOfferLink";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)/voucher");
  }
}

export default function PartnerVoucherScreen() {
  const { locale, t } = useLocale();
  const openPartnerOffer = usePartnerOfferLink();
  const { partner } = useLocalSearchParams<{ partner?: string }>();
  const offer = partner ? PARTNER_OFFERS.find((item) => item.partnerId === partner) : PARTNER_OFFERS[0];

  if (!offer) {
    return (
      <ScreenContainer>
        <BackHeader title={t("voucherDetail.title")} onBack={goBack} />
        <EmptyState
          icon="pricetags-outline"
          title={t("voucherDetail.notFound")}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackHeader title={t("voucherDetail.title")} onBack={goBack} />
      <Card
        variant="media"
        imageSource={offer.image}
        imageHeight={200}
        overlay={<Badge label={t(PARTNER_CATEGORY_LABELS[offer.category])} />}
      >
        <View style={styles.offer}>
          <View style={styles.partner}>
            <PartnerLogoMark source={offer.logo} />
            <Text accessibilityRole="header" style={styles.name}>{offer.name}</Text>
          </View>
          <Text style={styles.benefit}>{offer.benefit[locale]}</Text>
          <Text style={styles.copy}>{offer.address}</Text>
          {offer.soldOut && (
            <Badge label={t("partnerOffer.soldOut")} />
          )}
        </View>
      </Card>

      {!offer.soldOut && (
        <>
          <SectionHeader title={t("voucherDetail.terms")} />
          <Card style={styles.terms}>
            <Ionicons name="reader-outline" size={20} color={colors.navy} />
            <Text style={[styles.copy, styles.termsCopy]}>{t("partnerOffer.bookingTerms")}</Text>
          </Card>
          <Button
            title={t("partnerOffer.bookOnBooking")}
            variant="amber"
            icon="open-outline"
            iconPosition="right"
            onPress={() => openPartnerOffer({ redemptionUrl: offer.redemptionUrl })}
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  offer: { padding: spacing(1), gap: spacing(1.25) },
  partner: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  name: { flex: 1, color: colors.navy, fontSize: 16, fontWeight: "700" },
  benefit: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  termsCopy: { flex: 1 },
  terms: { flexDirection: "row", alignItems: "flex-start", gap: spacing(1.25) },
});
