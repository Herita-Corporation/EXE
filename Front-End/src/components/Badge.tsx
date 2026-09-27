import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/theme/colors";

export type BadgeTone =
  | "neutral"
  | "success"
  | "danger"
  | "warning"
  | "primary"
  | "gold"
  | "outline";

const TONE_BG: Record<BadgeTone, string> = {
  neutral: colors.surfaceAlt,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  primary: colors.primary,
  gold: colors.gold,
  outline: "transparent",
};

const TONE_TEXT: Record<BadgeTone, string> = {
  neutral: colors.text,
  success: colors.primaryText,
  danger: colors.primaryText,
  warning: colors.text,
  primary: colors.primaryText,
  gold: colors.navyDeep,
  outline: colors.navy,
};

export function Badge({
  label,
  tone = "neutral",
  style,
}: {
  label: string;
  tone?: BadgeTone;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: TONE_BG[tone] },
        tone === "outline" && styles.outline,
        style,
      ]}
    >
      <Text style={[styles.text, { color: TONE_TEXT[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontSize: 12, fontWeight: "600" },
});
