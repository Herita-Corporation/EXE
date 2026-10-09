import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconButton } from "@/components/IconButton";
import { colors, spacing } from "@/theme/colors";

// IconButton's default footprint (22px icon + 22px padding) — the right-hand
// spacer matches it so the title sits exactly centered.
const SIDE_WIDTH = 44;

/** Back arrow + centered title row used at the top of every sub-screen. */
export function BackHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  /** Optional trailing action; defaults to an empty spacer. */
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <IconButton icon="arrow-back" onPress={onBack} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.navy, textAlign: "center" },
  side: { width: SIDE_WIDTH, alignItems: "flex-end" },
});
