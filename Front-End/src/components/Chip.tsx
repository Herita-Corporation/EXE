import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme/colors";

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon color when not selected (defaults to navy). */
  iconColor?: string;
  style?: ViewStyle;
}

/** Single/multi-select filter pill (travel-style, transportation, voucher category...). */
export function Chip({ label, selected = false, onPress, icon, iconColor, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, style]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={selected ? colors.primaryText : iconColor ?? colors.navy}
          style={styles.icon}
        />
      ) : null}
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.75),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  icon: { marginRight: spacing(0.5) },
  text: { fontSize: 13, fontWeight: "600", color: colors.navy },
  textSelected: { color: colors.primaryText },
});
