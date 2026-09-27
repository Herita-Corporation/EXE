import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { colors, spacing } from "@/theme/colors";

interface Props {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** Labeled on/off row, used by Settings and the AI Guide setup screen. */
export function Toggle({ label, description, value, onValueChange }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.navy }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing(1.25),
  },
  textWrap: { flex: 1, paddingRight: spacing(2), gap: 2 },
  label: { color: colors.text, fontSize: 15, fontWeight: "600" },
  description: { color: colors.textMuted, fontSize: 12 },
});
