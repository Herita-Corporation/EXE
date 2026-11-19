import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PartnerLogoMark } from "@/components/PartnerLogoMark";
import type { PartnerOffer } from "@/mocks/partnerOffer";
import { brand, colors, radius, spacing } from "@/theme/colors";

export function PartnerLogoStrip({ offers }: { offers: readonly PartnerOffer[] }) {
  return (
    <View style={styles.strip}>
      <Text accessibilityRole="header" style={styles.label}>Trusted by</Text>
      <View style={styles.logos}>
        {offers.map(({ partnerId, name, logo }) => (
          <View key={partnerId} style={styles.slot}>
            <PartnerLogoMark source={logo} label={name} style={styles.logo} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing(1),
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
    backgroundColor: brand.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  label: { color: brand.navy, fontSize: 13, fontStyle: "italic", fontWeight: "700" },
  logos: {
    flexBasis: 330,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
  },
  slot: { flex: 1, minWidth: 0, alignItems: "center" },
  logo: { width: "100%", maxWidth: 120, height: 40 },
});
