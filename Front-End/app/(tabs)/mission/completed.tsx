import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { MissionThumb } from "@/components/MissionThumb";
import { listUserMissions } from "@/api/endpoints/missions";
import { useAuth } from "@/context/AuthContext";
import { UserMission } from "@/types/missions";
import { useSmartBack } from "@/utils/backNavigation";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

const COMPLETED_STATUS = 2;

export default function CompletedMissionsScreen() {
  const goBack = useSmartBack();
  const { user } = useAuth();
  const { t } = useLocale();
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = user ? await listUserMissions(user.id) : [];
      setMissions(all.filter((m) => m.status === COMPLETED_STATUS));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalPoints = missions.reduce((sum, m) => sum + m.rewardXP + m.rewardCoins, 0);

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={goBack} />
        <Text style={styles.title}>{t("completed.title")}</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.subtitle}>
        {t("completed.subtitle", { count: missions.length })}
      </Text>

      <View style={styles.statsRow}>
        <Badge label={`${totalPoints.toLocaleString()} ${t("completed.pointsEarned")}`} tone="primary" />
        <Badge label={`${missions.length} ${t("completed.missions")}`} tone="gold" />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.navy} />
      ) : missions.length === 0 ? (
        <EmptyState title={t("completed.emptyTitle")} />
      ) : (
        missions.map((m) => (
          <Pressable key={m.id} onPress={() => router.push(`/(tabs)/mission/${m.id}`)}>
            <Card style={styles.row}>
              <MissionThumb evidenceUrl={m.evidenceUrl} evidenceType={m.evidenceType} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{m.title}</Text>
                <Text style={styles.rowDate}>
                  {t("completed.completedPrefix")}{" "}
                  {m.completedAt ? new Date(m.completedAt).toLocaleDateString("vi-VN") : "—"}
                </Text>
              </View>
              <Badge label={`+${m.rewardXP + m.rewardCoins} ${t("completed.pts")}`} tone="success" />
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Card>
          </Pressable>
        ))
      )}

      {/* listUserMissions has no pagination params today — this is a
          disabled placeholder rather than a functional "load more". */}
      <Button title={t("completed.viewOlderHistory")} variant="outline" disabled onPress={() => {}} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  statsRow: { flexDirection: "row", gap: spacing(1) },
  row: { flexDirection: "row", alignItems: "center", gap: spacing(1.25) },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  rowDate: { fontSize: 11, color: colors.textMuted },
});
