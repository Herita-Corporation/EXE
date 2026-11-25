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
import {
  FEATURED_PARTNER_OFFER,
  isPartnerOfferActive,
  PARTNER_CATEGORY_LABELS,
  PARTNER_OFFERS,
} from "@/data/partnerOffers";
import { usePartnerOfferLink } from "@/hooks/usePartnerOfferLink";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";
import { formatDate } from "@/utils/date";

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
  const { partner = FEATURED_PARTNER_OFFER.partnerId } = useLocalSearchParams<{ partner?: string }>();
  const offer = PARTNER_OFFERS.find((item) => item.partnerId === partner);

  if (!offer || !isPartnerOfferActive(offer)) {
    return (
      <ScreenContainer>
        <BackHeader title={t("voucherDetail.title")} onBack={goBack} />
        <EmptyState
          icon="pricetags-outline"
          title={t(offer ? "partnerOffer.expired" : "voucherDetail.notFound")}
        />
      </ScreenContainer>
    );
  }

  const { title, benefit, terms } = offer.campaign[locale];
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
            <Text style={styles.name}>{offer.name}</Text>
          </View>
          <View style={styles.campaignCopy}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text style={styles.benefit}>{benefit}</Text>
          </View>
          {offer.expiresOn && (
            <Text style={styles.copy}>
              {t("voucherDetail.expires", { date: formatDate(offer.expiresOn, locale) })}
            </Text>
          )}
        </View>
      </Card>

      <SectionHeader title={t("voucherDetail.terms")} />
      <Card style={styles.terms}>
        <Ionicons name="reader-outline" size={20} color={colors.navy} />
        <Text style={styles.copy}>{terms}</Text>
      </Card>
      <Button
        title={t("partnerOffer.redeem")}
        variant="amber"
        icon="open-outline"
        iconPosition="right"
        onPress={() => openPartnerOffer(offer)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  offer: { padding: spacing(1), gap: spacing(1.25) },
  partner: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  name: { flex: 1, color: colors.navy, fontSize: 16, fontWeight: "700" },
  campaignCopy: { gap: spacing(0.5) },
  title: { color: colors.navy, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  benefit: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  copy: { flex: 1, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  terms: { flexDirection: "row", alignItems: "flex-start", gap: spacing(1.25) },
});
