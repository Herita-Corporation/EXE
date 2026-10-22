import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme/colors";

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.wrap}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(1),
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing(1.5),
  },
  text: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: "500" },
});
