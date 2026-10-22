import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { categoryStyle } from "@/utils/voucherCategory";
import { radius } from "@/theme/colors";

/** Gradient tile with a white category icon (voucher lists, offers, detail). */
export function VoucherIcon({
  category,
  icon,
  size = 48,
  style,
}: {
  category?: string | null;
  /** Override the category's default icon (e.g. a specific offer icon). */
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  style?: ViewStyle;
}) {
  const s = categoryStyle(category);
  return (
    <LinearGradient
      colors={s.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Math.round(size * 0.3), shadowColor: s.gradient[1] },
        style,
      ]}
    >
      {/* Soft top-left sheen for a bit of depth. */}
      <View style={[styles.sheen, { width: size * 0.9, height: size * 0.9, borderRadius: size }]} />
      <Ionicons name={icon ?? s.icon} size={Math.round(size * 0.48)} color="#FFFFFF" />
    </LinearGradient>
  );
}

/** Pill with the category's colored icon + label. Default is white (for
 * sitting on photos); `onLight` uses the category's soft tint instead. */
export function VoucherCategoryPill({ category, onLight = false }: { category: string; onLight?: boolean }) {
  const s = categoryStyle(category);
  return (
    <View style={[styles.pill, onLight && { backgroundColor: s.soft }]}>
      <Ionicons name={s.icon} size={12} color={s.color} />
      <Text style={[styles.pillText, { color: s.color }]}>{category}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sheen: {
    position: "absolute",
    top: -12,
    left: -12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pillText: { fontSize: 12, fontWeight: "800" },
});
