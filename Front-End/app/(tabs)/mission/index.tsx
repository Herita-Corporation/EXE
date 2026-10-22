import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { Card } from "@/components/Card";
import { IconButton } from "@/components/IconButton";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorBanner } from "@/components/ErrorBanner";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRow } from "@/components/Skeleton";
import { haptics } from "@/utils/haptics";
import { MissionThumb } from "@/components/MissionThumb";
import { FeaturedMissionCard } from "@/components/FeaturedMissionCard";
import { GradientHero } from "@/components/GradientHero";
import { deleteMission, listUserMissions, pruneMissions } from "@/api/endpoints/missions";
import { useToast } from "@/context/ToastContext";
import { getLiveItineraryIds } from "@/utils/itineraryHistory";
import { ApiError } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { MISSION_STATUS_KEY, MISSION_TYPE_KEY, UserMission } from "@/types/missions";
import { formatDate } from "@/utils/date";
import { useGamification } from "@/hooks/useGamification";
import { useLocale } from "@/i18n/LocaleContext";
import { FEATURED_MISSIONS } from "@/mocks/featuredMissions";
import { colors, radius, shadow, spacing } from "@/theme/colors";

// Active = not yet Completed/Rejected/Expired (see MISSION_STATUS_KEY).
const ACTIVE_STATUSES = new Set([0, 1]);
const COMPLETED_STATUS = 2;

type MissionTab = "active" | "completed";

// Status → pill colors (Assigned / PendingReview / Completed / Rejected / Expired).
const STATUS_TONE: Record<number, { bg: string; fg: string }> = {
  0: { bg: colors.blueSoft, fg: colors.link },
  1: { bg: colors.goldMuted, fg: colors.goldText },
  2: { bg: colors.successSoft, fg: colors.success },
  3: { bg: colors.dangerSoft, fg: colors.danger },
  4: { bg: colors.surfaceAlt, fg: colors.textMuted },
};

export default function MissionHomeScreen() {
  const { user } = useAuth();
  const gamification = useGamification();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [tab, setTab] = useState<MissionTab>("active");
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Drop missions of itineraries that no longer exist before listing.
      // Best-effort — a failed prune just shows the unpruned list.
      if (user) {
        try {
          await pruneMissions(user.id, await getLiveItineraryIds(user.id));
        } catch {}
      }
      const missionList = user ? await listUserMissions(user.id) : [];
      setMissions(missionList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("missionList.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

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

  function confirmDelete(m: UserMission) {
    Alert.alert(
      t("missionList.deleteTitle"),
      t("missionList.deleteMessage", { title: m.title }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMission(m.id);
              haptics.warning();
              setMissions((prev) => prev.filter((x) => x.id !== m.id));
              showToast(t("missionList.deleted"), "success");
            } catch (err) {
              showToast(err instanceof ApiError ? err.message : t("missionList.deleteFailed"), "error");
            }
          },
        },
      ]
    );
  }

  function confirmDeleteAll() {
    if (!user || activeMissions.length === 0) return;
    Alert.alert(
      t("missionList.deleteAllTitle"),
      t("missionList.deleteAllMessage", { count: activeMissions.length }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("missionList.deleteAllConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              // Prune with no trips to keep = every non-Completed mission;
              // the server never deletes Completed ones here.
              await pruneMissions(user.id, []);
              setMissions((prev) => prev.filter((m) => m.status === COMPLETED_STATUS));
              showToast(t("missionList.deletedAll"), "success");
            } catch (err) {
              showToast(err instanceof ApiError ? err.message : t("missionList.deleteFailed"), "error");
            }
          },
        },
      ]
    );
  }

  function openSample() {
    Alert.alert(t("mission.sampleTitle"), t("mission.sampleMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("mission.createToUnlock"), onPress: () => router.push("/(tabs)/mission/create") },
    ]);
  }

  return (
    <ScreenContainer
      avoidTabBar
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />
      }
    >
      <ScreenHeader
        title={t("tabs.mission")}
        subtitle={t("mission.headerSub")}
        right={
          <IconButton
            icon="add"
            variant="solid"
            size={22}
            onPress={() => router.push("/(tabs)/mission/create")}
          />
        }
      />

      {/* Points hero */}
      <GradientHero style={styles.pointsCard} markPosition="top-right" markStyle={{ width: 160, opacity: 0.1 }}>
        <View style={styles.pointsHeaderRow}>
          <Text style={styles.pointsLabel}>{t("mission.totalExplorationPoints")}</Text>
          <View style={styles.levelChip}>
            <Ionicons name="ribbon" size={13} color={colors.onAmber} />
            <Text style={styles.levelChipText}>
              {t("mission.level")} {gamification.level}
            </Text>
          </View>
        </View>
        <Text style={styles.pointsValue}>
          {gamification.points.toLocaleString()} <Text style={styles.pointsUnit}>{t("mission.pts")}</Text>
        </Text>
        <ProgressBar progress={progress} color={colors.gold} trackColor="rgba(255,255,255,0.15)" />
        <Text style={styles.tierText}>
          {gamification.pointsToNextTier.toLocaleString()} {t("mission.pointsUntil")}{" "}
          <Text style={styles.tierName}>{gamification.nextTierName}</Text>
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeMissions.length}</Text>
            <Text style={styles.statLabel}>{t("mission.activeMissions")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedMissions.length}</Text>
            <Text style={styles.statLabel}>{t("mission.completedMissions")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalCompletedPoints.toLocaleString()}</Text>
            <Text style={styles.statLabel}>{t("completed.pointsEarned")}</Text>
          </View>
        </View>
      </GradientHero>

      {/* Segmented control */}
      <View style={styles.tabRow}>
        {(["active", "completed"] as const).map((key) => {
          const selected = tab === key;
          const count = key === "active" ? activeMissions.length : completedMissions.length;
          return (
            <Pressable
              key={key}
              style={[styles.tabButton, selected && styles.tabButtonActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabButtonText, selected && styles.tabButtonTextActive]}>
                {key === "active" ? t("mission.activeMissions") : t("mission.completedMissions")}
              </Text>
              <View style={[styles.countBubble, selected && styles.countBubbleActive]}>
                <Text style={[styles.countText, selected && styles.countTextActive]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {tab === "active" && activeMissions.length > 0 ? (
        <Pressable
          onPress={confirmDeleteAll}
          hitSlop={8}
          style={({ pressed }) => [styles.deleteAllBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
          <Text style={styles.deleteAllText}>{t("missionList.deleteAll")}</Text>
        </Pressable>
      ) : null}

      <ErrorBanner message={error} />

      {loading ? (
        <>
          <SkeletonRow thumbSize={64} />
          <SkeletonRow thumbSize={64} />
          <SkeletonRow thumbSize={64} />
        </>
      ) : tab === "active" ? (
        activeMissions.length === 0 ? (
          <>
            <EmptyState
              icon="flag-outline"
              title={t("mission.emptyActiveTitle")}
              description={t("mission.emptyActiveDescription")}
            />
            <SectionHeader title={t("mission.suggested")} />
            {FEATURED_MISSIONS.map((m) => (
              <FeaturedMissionCard key={m.id} mission={m} variant="wide" onPress={openSample} />
            ))}
          </>
        ) : (
          activeMissions.map((m) => (
            <MissionRow key={m.id} mission={m} onDelete={() => confirmDelete(m)} />
          ))
        )
      ) : completedMissions.length === 0 ? (
        <EmptyState icon="trophy-outline" title={t("mission.emptyCompletedTitle")} />
      ) : (
        completedMissions.map((m) => <MissionRow key={m.id} mission={m} completed />)
      )}
    </ScreenContainer>
  );
}

function MissionRow({
  mission: m,
  completed = false,
  onDelete,
}: {
  mission: UserMission;
  completed?: boolean;
  /** Omitted for completed missions — those are kept, never deleted. */
  onDelete?: () => void;
}) {
  const { t, locale } = useLocale();
  const tone = STATUS_TONE[m.status] ?? STATUS_TONE[4];

  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/mission/${m.id}`)}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      <Card variant="elevated" style={styles.missionCard}>
        <MissionThumb evidenceUrl={m.evidenceUrl} evidenceType={m.evidenceType} size={64} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.missionTopRow}>
            <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
              <Text style={[styles.statusText, { color: tone.fg }]}>
                {MISSION_STATUS_KEY[m.status] ? t(MISSION_STATUS_KEY[m.status]) : "—"}
              </Text>
            </View>
            {MISSION_TYPE_KEY[m.type] ? (
              <Text style={styles.typeText}>{t(MISSION_TYPE_KEY[m.type])}</Text>
            ) : null}
          </View>
          <Text style={styles.missionTitle} numberOfLines={2}>{m.title}</Text>
          {completed ? (
            <Text style={styles.completedDate}>
              {t("completed.completedPrefix")}{" "}
              {formatDate(m.completedAt, locale)}
            </Text>
          ) : null}
          <View style={styles.rewardRow}>
            <View style={styles.rewardPill}>
              <Ionicons name="flash" size={11} color={colors.primary} />
              <Text style={styles.rewardText}>+{m.rewardXP} XP</Text>
            </View>
            <View style={[styles.rewardPill, { backgroundColor: colors.goldMuted }]}>
              <Ionicons name="star" size={11} color={colors.gold} />
              <Text style={[styles.rewardText, { color: colors.goldText }]}>+{m.rewardCoins}</Text>
            </View>
          </View>
        </View>
        {onDelete ? (
          <Pressable
            onPress={onDelete}
            hitSlop={10}
            style={styles.moreBtn}
            accessibilityLabel={t("extra.missionActions")}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pointsCard: { gap: spacing(1.25) },
  pointsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pointsLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing(1.25),
  },
  levelChipText: { color: colors.onAmber, fontSize: 12, fontWeight: "800" },
  pointsValue: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  pointsUnit: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  tierText: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  tierName: { color: "#FFFFFF", fontWeight: "700" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(1),
    paddingTop: spacing(1.5),
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.12)" },

  tabRow: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing(1.1),
    borderRadius: radius.pill,
  },
  tabButtonActive: { backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.1 },
  tabButtonText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  tabButtonTextActive: { color: colors.navy },
  countBubble: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  countBubbleActive: { backgroundColor: colors.primary },
  countText: { fontSize: 11, fontWeight: "800", color: colors.textMuted },
  countTextActive: { color: "#FFFFFF" },

  missionCard: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  deleteAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-end",
    paddingVertical: spacing(0.25),
  },
  deleteAllText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  moreBtn: {
    width: 28,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  missionTopRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  statusPill: { borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: spacing(1) },
  statusText: { fontSize: 11, fontWeight: "800" },
  typeText: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  missionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  completedDate: { fontSize: 12, color: colors.textMuted },
  rewardRow: { flexDirection: "row", gap: spacing(0.75) },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing(1),
  },
  rewardText: { fontSize: 11, fontWeight: "800", color: colors.link },
});
