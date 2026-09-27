import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme/colors";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress?: () => void;
  danger?: boolean;
  /** Overrides the default trailing chevron (e.g. a value + chevron, or nothing). */
  right?: React.ReactNode;
}

/** A tappable icon+label row used across Account and Settings screens. */
export function SettingsRow({ icon, label, description, onPress, danger, right }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.25),
    paddingVertical: spacing(1.25),
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDanger: { backgroundColor: "rgba(225,84,61,0.1)" },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  labelDanger: { color: colors.danger },
  description: { fontSize: 11, color: colors.textMuted },
});
