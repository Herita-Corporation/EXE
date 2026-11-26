import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";

interface Props {
  count: number;
  activeIndex: number;
  onLightBackground?: boolean;
  accessibilityLabel?: string;
}

export function PaginationDots({ count, activeIndex, onLightBackground, accessibilityLabel }: Props) {
  const activeColor = onLightBackground ? colors.primary : colors.gold;
  const inactiveColor = onLightBackground ? colors.textMuted : "rgba(255,255,255,0.5)";

  return (
    <View style={styles.row} accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === activeIndex ? styles.dotActive : styles.dotInactive,
            { backgroundColor: i === activeIndex ? activeColor : inactiveColor },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  dotInactive: { width: 8 },
});
