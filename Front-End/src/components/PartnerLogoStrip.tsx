import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/i18n/LocaleContext";
import { PARTNER_OFFERS, type PartnerOffer } from "@/mocks/partnerOffer";
import { colors, radius, spacing } from "@/theme/colors";

export function PartnerLogoMark({ logo, size = 28 }: { logo: PartnerOffer["logo"]; size?: number }) {
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * logo.cornerRatio, backgroundColor: logo.color },
      ]}
    >
      <Ionicons name={logo.icon} size={size * 0.59} color="#FFFFFF" />
    </View>
  );
}

export function PartnerLogoStrip() {
  const { t } = useLocale();

  return (
    <View style={styles.strip}>
      <Text accessibilityRole="header" style={styles.label}>{t("home.partners")}</Text>
      <View style={styles.divider} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.logos}
      >
        {PARTNER_OFFERS.map(({ partnerId, name, logo }) => (
          <Pressable
            key={partnerId}
            accessibilityRole="link"
            accessibilityLabel={name}
            accessibilityHint={t("partnerOffer.viewPartnerVouchers")}
            onPress={() => router.navigate({
              pathname: "/(tabs)/voucher",
              params: { partner: partnerId },
            })}
            style={({ pressed }) => [styles.logo, pressed && styles.pressed]}
          >
            <PartnerLogoMark logo={logo} />
            <Text style={[styles.name, { color: logo.color }]}>{logo.wordmark}</Text>
            <Text style={[styles.descriptor, { color: logo.color }]}>{logo.descriptor}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", fontStyle: "italic" },
  divider: { height: 32, width: 1, backgroundColor: colors.border, marginHorizontal: spacing(0.75) },
  scroller: { flex: 1 },
  logos: { flexGrow: 1, alignItems: "center", justifyContent: "space-between", gap: spacing(0.5) },
  logo: {
    minHeight: 64,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(0.25),
    gap: 2,
  },
  mark: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.25, textTransform: "uppercase" },
  descriptor: { fontSize: 8, fontWeight: "600", letterSpacing: 1.15, textTransform: "uppercase" },
  pressed: { opacity: 0.65 },
});
