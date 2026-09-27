import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorBanner } from "@/components/ErrorBanner";
import { EmptyState } from "@/components/EmptyState";
import { MissionThumb } from "@/components/MissionThumb";
import { listUserMissions } from "@/api/endpoints/missions";
import { ApiError } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { UserMission } from "@/types/missions";
import { useGamification } from "@/hooks/useGamification";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

// Active = not yet Completed/Rejected/Expired (see MISSION_STATUS_LABEL).
const ACTIVE_STATUSES = new Set([0, 1]);
const COMPLETED_STATUS = 2;

type MissionTab = "active" | "completed";

export default function MissionHomeScreen() {
  const { user } = useAuth();
  const gamification = useGamification();
  const { t } = useLocale();
  const [tab, setTab] = useState<MissionTab>("active");
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const missionList = user ? await listUserMissions(user.id) : [];
      setMissions(missionList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được nhiệm vụ.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  // Nhiệm vụ nhận từ itinerary (assignMission ở mission/itinerary/[id].tsx)
  // và mọi nhiệm vụ khác đều đi qua chung UserMissions này — chỉ khác nhau ở
  // status, nên 2 tab dưới đây lọc từ cùng 1 danh sách đã tải, không gọi
  // API riêng cho từng tab.
  const activeMissions = missions.filter((m) => ACTIVE_STATUSES.has(m.status));
  const completedMissions = missions.filter((m) => m.status === COMPLETED_STATUS);
  const totalCompletedPoints = completedMissions.reduce(
    (sum, m) => sum + m.rewardXP + m.rewardCoins,
    0
  );

  const progress = gamification.points / (gamification.points + gamification.pointsToNextTier);

  return (
    <ScreenContainer avoidTabBar backgroundColor={colors.surface}>
      <Card style={styles.pointsCard}>
        <View style={styles.pointsHeaderRow}>
          <Text style={styles.pointsLabel}>{t("mission.totalExplorationPoints")}</Text>
          <View style={styles.levelBadge}>
            <Ionicons name="ribbon-outline" size={16} color={colors.gold} />
          </View>
        </View>
        <Text style={styles.pointsValue}>
          {gamification.points.toLocaleString()} <Text style={styles.pointsUnit}>{t("mission.pts")}</Text>
        </Text>
        <View style={styles.progressRow}>
          <ProgressBar progress={progress} style={{ flex: 1 }} />
          <Text style={styles.levelText}>{t("mission.level")} {gamification.level}</Text>
        </View>
        <Text style={styles.tierText}>
          {gamification.pointsToNextTier.toLocaleString()} {t("mission.pointsUntil")}{" "}
          {gamification.nextTierName}
        </Text>
      </Card>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, tab === "active" && styles.tabButtonActive]}
          onPress={() => setTab("active")}
        >
          <Text style={[styles.tabButtonText, tab === "active" && styles.tabButtonTextActive]}>
            {t("mission.activeMissions")} ({activeMissions.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, tab === "completed" && styles.tabButtonActive]}
          onPress={() => setTab("completed")}
        >
          <Text style={[styles.tabButtonText, tab === "completed" && styles.tabButtonTextActive]}>
            {t("mission.completedMissions")} ({completedMissions.length})
          </Text>
        </Pressable>
      </View>

      <ErrorBanner message={error} />

      {loading ? (
        <ActivityIndicator color={colors.navy} />
      ) : tab === "active" ? (
        <>
          {activeMissions.length === 0 ? (
            <EmptyState
              title={t("mission.emptyActiveTitle")}
              description={t("mission.emptyActiveDescription")}
            />
          ) : (
            activeMissions.map((m) => (
              <Pressable key={m.id} onPress={() => router.push(`/(tabs)/mission/${m.id}`)}>
                <Card style={styles.missionCard}>
                  <MissionThumb evidenceUrl={m.evidenceUrl} evidenceType={m.evidenceType} size={56} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Badge label={t("mission.mission")} tone="outline" />
                    <Text style={styles.missionTitle}>{m.title}</Text>
                    <View style={styles.starsRow}>
                      {[0, 1].map((i) => (
                        <Ionicons key={i} name="star" size={12} color={colors.gold} />
                      ))}
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))
          )}
        </>
      ) : completedMissions.length === 0 ? (
        <EmptyState title={t("mission.emptyCompletedTitle")} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <Badge label={`${totalCompletedPoints.toLocaleString()} ${t("completed.pointsEarned")}`} tone="primary" />
            <Badge label={`${completedMissions.length} ${t("completed.missions")}`} tone="gold" />
          </View>
          {completedMissions.map((m) => (
            <Pressable key={m.id} onPress={() => router.push(`/(tabs)/mission/${m.id}`)}>
              <Card style={styles.missionCard}>
                <MissionThumb evidenceUrl={m.evidenceUrl} evidenceType={m.evidenceType} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.missionTitle}>{m.title}</Text>
                  <Text style={styles.completedDate}>
                    {t("completed.completedPrefix")}{" "}
                    {m.completedAt ? new Date(m.completedAt).toLocaleDateString("vi-VN") : "—"}
                  </Text>
                </View>
                <Badge label={`+${m.rewardXP + m.rewardCoins} ${t("completed.pts")}`} tone="success" />
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pointsCard: { backgroundColor: colors.navy, borderWidth: 0, gap: spacing(1) },
  pointsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pointsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  levelBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  pointsValue: { color: "#FFFFFF", fontSize: 32, fontWeight: "800" },
  pointsUnit: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  levelText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  tierText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  tabRow: {
    flexDirection: "row",
    gap: spacing(1),
    marginTop: spacing(1),
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing(1),
    borderRadius: 999,
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: colors.navy },
  tabButtonText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  tabButtonTextActive: { color: "#FFFFFF" },
  statsRow: { flexDirection: "row", gap: spacing(1) },
  completedDate: { fontSize: 11, color: colors.textMuted },
  missionCard: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  missionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  starsRow: { flexDirection: "row", gap: 2 },
});
