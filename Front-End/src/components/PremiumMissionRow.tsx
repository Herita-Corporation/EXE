import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/Badge";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";
import type { PremiumMission, PremiumMissionScope } from "@/types/premium";

export function PremiumMissionRow({
  mission,
  scope,
  scopeId,
  selected = false,
}: {
  mission: PremiumMission;
  scope: PremiumMissionScope;
  scopeId: string;
  selected?: boolean;
}) {
  const { t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({
        pathname: "/(tabs)/mission/premium/evidence/[missionId]",
        params: { missionId: mission.id, scope, scopeId },
      })}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Ionicons name={mission.evidenceType === "photo" ? "camera-outline" : "videocam-outline"} size={21} color={colors.navy} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{mission.title}</Text>
        <Text style={styles.subtitle}>{mission.placeName} · {t(mission.evidenceType === "photo" ? "premium.photo" : "premium.video")}</Text>
        {mission.completedAt ? <Badge label={t("premium.completed")} tone="success" /> : (
          mission.accepted && scope === "special" && <Badge label={t("premium.accepted")} tone="tint" />
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 70,
    padding: spacing(1.5),
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.25),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  selected: { borderColor: colors.navy },
  pressed: { opacity: 0.72 },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.blueSoft },
  info: { flex: 1, gap: spacing(0.5) },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted },
});
