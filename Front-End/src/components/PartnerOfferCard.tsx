import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { PartnerLogoMark } from "@/components/PartnerLogoStrip";
import { useLocale } from "@/i18n/LocaleContext";
import { PARTNER_CATEGORY_COPY, type PartnerOffer } from "@/mocks/partnerOffer";
import { colors, radius, spacing } from "@/theme/colors";

export function PartnerOfferCard({ offer, compact = false }: { offer: PartnerOffer; compact?: boolean }) {
  const { t } = useLocale();
  const copy = PARTNER_CATEGORY_COPY[offer.category];
  const headline = t(copy.headline, { discount: offer.discountPercent });

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${offer.name}. ${headline}`}
      onPress={() => router.push({ pathname: "/partner-voucher", params: { partner: offer.partnerId } })}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card
        variant={compact ? "flat" : "media"}
        imageSource={offer.image}
        imageHeight={150}
        overlay={<Badge label={t(copy.label)} />}
      >
        <View style={styles.summary}>
          <PartnerLogoMark logo={offer.logo} size={44} />
          <View style={styles.summaryCopy}>
            {compact ? (
              <Text style={styles.context}>{t("partnerOffer.staySuggestion")}</Text>
            ) : null}
            <Text style={[styles.name, { color: offer.logo.color }]}>{offer.name}</Text>
            <Text style={styles.offer}>{headline}</Text>
          </View>
          {compact ? <Ionicons name="chevron-forward" size={18} color={colors.navy} /> : null}
        </View>
        {compact ? null : (
          <View style={styles.catalogFooter}>
            <View style={styles.inline}>
              <Ionicons name="star" size={15} color={colors.gold} />
              <Text style={styles.points}>
                {t("partnerOffer.points", { points: offer.pointsCost })}
              </Text>
            </View>
            <View style={styles.catalogAction}>
              <Text style={styles.catalogActionText}>{t("partnerOffer.viewVoucher")}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primaryText} />
            </View>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: spacing(0.75) },
  pressed: { opacity: 0.82 },
  summary: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  summaryCopy: { flex: 1, gap: 2 },
  context: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "800" },
  offer: { color: colors.text, fontSize: 13, lineHeight: 18 },
  catalogFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing(1),
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing(1),
    marginTop: spacing(0.75),
  },
  points: { color: colors.navy, fontSize: 13, fontWeight: "800" },
  catalogAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.75),
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.5),
  },
  catalogActionText: { color: colors.primaryText, fontSize: 13, fontWeight: "700", flexShrink: 1 },
});
