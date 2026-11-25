import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { PartnerLogoMark } from "@/components/PartnerLogoMark";
import type { PartnerOffer } from "@/data/partnerOffers";
import { useLocale } from "@/i18n/LocaleContext";
import { brand, radius, spacing } from "@/theme/colors";

export function PartnerOfferBanner({ offer }: { offer: PartnerOffer }) {
  const { locale, t } = useLocale();
  const benefit = offer.benefit[locale];

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${offer.name}. ${benefit}`}
      accessibilityHint={t("partnerOffer.viewPartnerVouchers")}
      onPress={() => router.navigate({
        pathname: "/(tabs)/voucher",
        params: { partner: offer.partnerId },
      })}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
    >
      <Image source={offer.image} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(8,29,64,0.96)", "rgba(8,29,64,0.72)", "rgba(8,29,64,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        locations={[0.08, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.copy}>
        <View style={styles.logoPanel}>
          <PartnerLogoMark source={offer.logo} style={styles.logo} />
        </View>
        <View style={styles.campaignCopy}>
          <Text style={styles.title}>{offer.name}</Text>
          <Text style={styles.benefit}>{benefit}</Text>
        </View>
        <View style={styles.action}>
          <Text style={styles.actionText}>{t("partnerOffer.viewVoucher")}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexGrow: 1,
    minHeight: 176,
    justifyContent: "center",
    padding: spacing(2),
    overflow: "hidden",
    backgroundColor: brand.navy,
    borderRadius: radius.lg,
  },
  pressed: { opacity: 0.85 },
  copy: { maxWidth: "75%", gap: spacing(1) },
  logoPanel: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing(0.75),
    paddingVertical: spacing(0.5),
    backgroundColor: brand.white,
    borderRadius: radius.sm,
  },
  logo: { width: 82, height: 38 },
  campaignCopy: { gap: 2 },
  title: { color: brand.white, fontSize: 28, lineHeight: 33, fontWeight: "800" },
  benefit: { color: brand.amber, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  action: {
    alignSelf: "flex-start",
    backgroundColor: brand.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
  },
  actionText: { color: brand.navy, fontSize: 13, fontWeight: "800" },
});
