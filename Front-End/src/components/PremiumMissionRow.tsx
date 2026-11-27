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
        params: { missionId: mission.id, scope, scopeId, title: mission.title, evidenceType: mission.evidenceType, instruction: mission.instruction, gps: mission.checkpoint ? '1':'0' },
      })}
      disabled={!mission.accepted || !!mission.completedAt}
      style={({ pressed }) => [styles.row, selected && styles.selected, mission.checkpoint && { borderLeftWidth: 4, borderLeftColor: {easy:'#138663', medium:'#996600', advanced:'#8145ac'}[mission.checkpoint.difficulty] }, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Ionicons name={mission.evidenceType === "photo" ? "camera-outline" : "videocam-outline"} size={21} color={colors.navy} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{mission.title}</Text>
        <Text style={styles.subtitle}>{mission.placeName} · {t(mission.evidenceType === "photo" ? "premium.photo" : "premium.video")}</Text>
        {!!mission.checkpoint && <Text style={styles.subtitle}>{{easy:'Dễ', medium:'Vừa', advanced:'Thử thách'}[mission.checkpoint.difficulty]} · GPS 120 m · {mission.checkpoint.requiresWindow ? 'Chỉ nhận minh chứng trong khung giờ' : 'Khung thưởng'} · +{mission.checkpoint.bonus} điểm từ {mission.checkpoint.fromHour}h đến trước {mission.checkpoint.untilHour}h (giờ Việt Nam)</Text>}
        <Text style={styles.subtitle}>{mission.instruction}</Text>
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
