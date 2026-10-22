import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme/colors";

/** Large left-aligned title used at the top of every tab root screen. */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), marginTop: spacing(0.5) },
  title: { fontSize: 26, fontWeight: "800", color: colors.navy, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
