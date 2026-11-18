import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "@/components/BackHeader";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PartnerLogoMark } from "@/components/PartnerLogoStrip";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionHeader } from "@/components/SectionHeader";
import { useLocale } from "@/i18n/LocaleContext";
import { PARTNER_CATEGORY_COPY, PARTNER_OFFERS, VINH_LAM_OFFER } from "@/mocks/partnerOffer";
import { colors, radius, spacing } from "@/theme/colors";

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)/voucher");
  }
}

export default function PartnerVoucherScreen() {
  const { t } = useLocale();
  const { partner = VINH_LAM_OFFER.partnerId } = useLocalSearchParams<{ partner?: string }>();
  const offer = PARTNER_OFFERS.find((item) => item.partnerId === partner);

  if (!offer) {
    return (
      <ScreenContainer>
        <BackHeader title={t("voucherDetail.title")} onBack={goBack} />
        <EmptyState icon="pricetags-outline" title={t("voucherDetail.notFound")} />
      </ScreenContainer>
    );
  }

  const copy = PARTNER_CATEGORY_COPY[offer.category];
  return (
    <ScreenContainer>
      <BackHeader title={t("voucherDetail.title")} onBack={goBack} />
      <Card
        variant="media"
        imageSource={offer.image}
        imageHeight={200}
        overlay={<Badge label={t(copy.label)} />}
      >
        <View style={styles.offer}>
          <View style={styles.partner}>
            <PartnerLogoMark logo={offer.logo} size={34} />
            <Text style={[styles.name, { color: offer.logo.color }]}>{offer.name}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.discount}>
            {t(copy.headline, { discount: offer.discountPercent })}
          </Text>
          <View style={styles.redemption}>
            <View style={styles.points}>
              <Ionicons name="star" size={16} color={colors.gold} />
              <Text style={styles.pointsText}>
                {t("partnerOffer.points", { points: offer.pointsCost })}
              </Text>
            </View>
            <Badge label={t("partnerOffer.redemptionPending")} />
          </View>
        </View>
      </Card>

      <SectionHeader title={t("voucherDetail.terms")} />
      <Card style={styles.terms}>
        <Ionicons name="reader-outline" size={20} color={colors.navy} />
        <Text style={styles.copy}>{t(copy.terms)}</Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  offer: { padding: spacing(1), gap: spacing(1.25) },
  partner: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  name: { flex: 1, fontSize: 16, fontWeight: "700" },
  discount: { color: colors.navy, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  redemption: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing(1) },
  points: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing(0.75),
    backgroundColor: colors.goldMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
  },
  pointsText: { color: colors.navy, fontSize: 13, fontWeight: "800" },
  copy: { flex: 1, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  terms: { flexDirection: "row", alignItems: "flex-start", gap: spacing(1.25) },
});
