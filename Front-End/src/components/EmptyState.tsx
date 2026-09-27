import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme/colors";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing(3), alignItems: "center", gap: spacing(1) },
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
});
