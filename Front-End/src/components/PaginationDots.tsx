import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";

interface Props {
  count: number;
  activeIndex: number;
}

/** Onboarding-style dot row; the active dot is gold and pill-shaped. */
export function PaginationDots({ count, activeIndex }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 24, backgroundColor: colors.gold },
  dotInactive: { width: 8, backgroundColor: "rgba(255,255,255,0.5)" },
});
