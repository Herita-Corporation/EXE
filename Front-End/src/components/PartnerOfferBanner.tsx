import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { PartnerLogoMark } from "@/components/PartnerLogoMark";
import { useLocale } from "@/i18n/LocaleContext";
import type { PartnerOffer } from "@/mocks/partnerOffer";
import { brand, radius, spacing } from "@/theme/colors";

export function PartnerOfferBanner({ offer, featured = false }: { offer: PartnerOffer; featured?: boolean }) {
  const { locale, t } = useLocale();
  const { title, benefit } = offer.campaign[locale];

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${offer.name}. ${title}. ${benefit}`}
      accessibilityHint={t("partnerOffer.viewPartnerVouchers")}
      onPress={() => router.navigate({
        pathname: "/(tabs)/voucher",
        params: { partner: offer.partnerId },
      })}
      style={({ pressed }) => [
        styles.banner,
        featured ? styles.featured : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Image source={offer.image} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={featured
          ? ["rgba(8,29,64,0.96)", "rgba(8,29,64,0.72)", "rgba(8,29,64,0)"]
          : ["rgba(8,29,64,0.08)", "rgba(8,29,64,0.60)", "rgba(8,29,64,0.94)"]}
        start={featured ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
        end={featured ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
        locations={featured ? [0.08, 0.52, 1] : [0, 0.44, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.copy, featured && styles.featuredCopy]}>
        <View style={styles.logoPanel}>
          <PartnerLogoMark source={offer.logo} style={featured ? styles.featuredLogo : styles.logo} />
        </View>
        <View style={styles.campaignCopy}>
          <Text style={[styles.title, featured && styles.featuredTitle]}>{title}</Text>
          <Text style={[styles.benefit, featured && styles.featuredBenefit]}>{benefit}</Text>
        </View>
        {featured ? (
          <View style={styles.action}>
            <Text style={styles.actionText}>{t("partnerOffer.viewVoucher")}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { overflow: "hidden", backgroundColor: brand.navy, borderRadius: radius.md },
  featured: { minHeight: 176, justifyContent: "center", padding: spacing(2), borderRadius: radius.lg },
  secondary: { flexBasis: "46%", flexGrow: 1, minHeight: 124, justifyContent: "flex-end", padding: spacing(1.25) },
  pressed: { opacity: 0.85 },
  copy: { gap: spacing(0.75) },
  featuredCopy: { maxWidth: "75%", gap: spacing(1) },
  logoPanel: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing(0.75),
    paddingVertical: spacing(0.5),
    backgroundColor: brand.white,
    borderRadius: radius.sm,
  },
  logo: { width: 64, height: 28 },
  featuredLogo: { width: 82, height: 38 },
  campaignCopy: { gap: 2 },
  title: { color: brand.white, fontSize: 16, lineHeight: 21, fontWeight: "800" },
  featuredTitle: { fontSize: 28, lineHeight: 33 },
  benefit: { color: brand.amber, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  featuredBenefit: { fontSize: 14, lineHeight: 20 },
  action: {
    alignSelf: "flex-start",
    backgroundColor: brand.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
  },
  actionText: { color: brand.navy, fontSize: 13, fontWeight: "800" },
});
