import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  deleteItinerary,
  getActivityAlternatives,
  getItinerary,
  replaceActivity,
} from "@/api/endpoints/itinerary";
import { assignMission, deleteMissionsForTrip, listMissionTemplates } from "@/api/endpoints/missions";
import { ApiError } from "@/api/http";
import {
  addItineraryToHistory,
  getItineraryHistory,
  markItineraryStarted,
  removeItineraryFromHistory,
  setItineraryWaypointIndex,
} from "@/utils/itineraryHistory";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getRegionImage } from "@/data/regionImages";
import type { Activity, ActivityAlternative, ItineraryResponse } from "@/types/itinerary";
import { MISSION_TYPE_PHOTO, MISSION_TYPE_VIDEO, MissionTemplate } from "@/types/missions";
import { colors, radius, spacing } from "@/theme/colors";

// Editing a "how to get there" leg doesn't map to "pick a similar place" —
// only real place-bound activities are swappable.
function isEditablePlace(activity: Activity) {
  return activity.type !== "transportation";
}

// AI-Itinerary sends `type` as a raw English enum value (see ActivityType in
// app/schemas/itinerary.py) — translate it for display instead of showing
// the wire value as-is.
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  transportation: "Di chuyển",
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  attraction: "Tham quan",
  hotel: "Khách sạn",
  shopping: "Mua sắm",
  experience: "Trải nghiệm",
  market: "Chợ",
  coffee: "Cà phê",
};

function activityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABEL[type] ?? type;
}

function formatVnd(n: number) {
  return `${Math.round(n).toLocaleString("vi-VN")} VND`;
}

// Meters between two GPS points (haversine) — used to detect "arrived" at
// the current navigation waypoint.
function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ARRIVAL_RADIUS_METERS = 150;

function openMapsFor(activity: Activity) {
  if (!activity.coordinates) return;
  const { lat, lng } = activity.coordinates;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
}

function MissionChip({
  icon,
  label,
  doneLabel,
  done,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  doneLabel: string;
  done: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={done || loading} onPress={onPress} style={[styles.missionChip, done && styles.missionChipDone]}>
      <Ionicons name={done ? "checkmark-circle" : icon} size={14} color={done ? colors.success : colors.navy} />
      <Text style={[styles.missionChipText, done && styles.missionChipTextDone]}>
        {done ? doneLabel : label}
      </Text>
    </Pressable>
  );
}

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<ItineraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [assignedKeys, setAssignedKeys] = useState<Set<string>>(new Set());
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [alternatives, setAlternatives] = useState<ActivityAlternative[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [replacingActivityId, setReplacingActivityId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [waypointIndex, setWaypointIndex] = useState(0);
  const waypointIndexRef = useRef(0);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);

  // Flattened, in-order list of geocoded activities (fixed anchors only —
  // see AI-Itinerary's itinerary_orchestrator.py) across every day — the
  // sequence GPS navigation walks through. Transportation legs are excluded
  // even if they carry coordinates (e.g. from an itinerary cached before the
  // backend stopped geocoding them) — a transportation activity's name is a
  // movement description, not a place, so its coordinates point nowhere
  // reliable and it's not something you "arrive at".
  const waypoints = useMemo(
    () =>
      data?.days
        .flatMap((day) => day.activities)
        .filter((a) => a.coordinates && a.type !== "transportation") ?? [],
    [data]
  );

  useEffect(() => {
    listMissionTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  // Matched by exact name, not just type — other custom templates of the
  // same type may exist (e.g. admin-created ones), and only these two
  // reusable "capture memory" templates (seeded in GamificatonDBb.sql) are
  // meant to be auto-suggested per itinerary activity.
  const photoTemplate = templates.find(
    (t) => t.type === MISSION_TYPE_PHOTO && t.name === "Chụp ảnh kỷ niệm"
  );
  const videoTemplate = templates.find(
    (t) => t.type === MISSION_TYPE_VIDEO && t.name === "Quay video khám phá"
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      getItinerary(id)
        .then((res) => !cancelled && setData(res))
        .catch(
          (err) =>
            !cancelled &&
            setError(err instanceof ApiError ? err.message : "Không tải được lịch trình.")
        )
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  // Lộ trình được backend lưu ngay khi generate, nhưng chỉ xuất hiện trong
  // "Lộ trình của tôi" sau khi user bấm xác nhận — kiểm tra xem đã xác nhận
  // (đã có trong lịch sử local) từ trước hay chưa mỗi khi màn hình mở lại.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      getItineraryHistory(user.id).then((history) => {
        if (cancelled) return;
        const entry = history.find((h) => h.id === id);
        setConfirmed(!!entry);
        setStarted(!!entry?.startedAt);
        const idx = entry?.currentWaypointIndex ?? 0;
        setWaypointIndex(idx);
        waypointIndexRef.current = idx;
      });
      return () => {
        cancelled = true;
      };
    }, [user, id])
  );

  function onDelete() {
    Alert.alert("Xóa lịch trình", "Bạn chắc chắn muốn xóa lịch trình này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteItinerary(id);
            try {
              // Best-effort — the itinerary is already gone either way; a
              // stray active mission left behind isn't worth blocking on.
              // Completed missions are kept server-side (see
              // DeleteByTripIdExceptCompletedAsync).
              await deleteMissionsForTrip(id);
            } catch {}
            if (user) await removeItineraryFromHistory(user.id, id);
            router.back();
          } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Không thể xóa.", "error");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  async function onAssignMission(
    activity: Activity,
    template: MissionTemplate,
    label: string
  ) {
    if (!user || !data) return;
    const key = `${activity.activity_id}:${template.type}`;
    setAssigningKey(key);
    try {
      await assignMission({
        userId: user.id,
        tripId: data.itinerary_id,
        placeId: activity.activity_id,
        templateId: template.id,
        title: `${label} tại ${activity.name}`,
      });
      setAssignedKeys((prev) => new Set(prev).add(key));
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không thể giao nhiệm vụ.", "error");
    } finally {
      setAssigningKey(null);
    }
  }

  async function onEditActivity(activity: Activity) {
    if (!isEditablePlace(activity)) return;
    setEditingActivity(activity);
    setAlternatives([]);
    setLoadingAlternatives(true);
    try {
      const res = await getActivityAlternatives(id, activity.activity_id);
      setAlternatives(res.alternatives);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không thể tải gợi ý địa điểm.", "error");
      setEditingActivity(null);
    } finally {
      setLoadingAlternatives(false);
    }
  }

  async function onSelectAlternative(alt: ActivityAlternative) {
    if (!editingActivity) return;
    setReplacingActivityId(editingActivity.activity_id);
    try {
      const updated = await replaceActivity(id, editingActivity.activity_id, alt);
      setData(updated);
      setEditingActivity(null);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không thể đổi địa điểm.", "error");
    } finally {
      setReplacingActivityId(null);
    }
  }

  // Backend đã lưu lộ trình ngay lúc generate (không có khái niệm "nháp") —
  // bước "xác nhận" ở đây quyết định việc lộ trình có xuất hiện trong "Lộ
  // trình của tôi" hay không, KHÔNG phải thanh toán. Số tiền hiển thị ở thẻ
  // tóm tắt bên trên chỉ là ước tính.
  async function onConfirmItinerary() {
    if (!user || !data) return;
    setConfirming(true);
    try {
      await addItineraryToHistory(user.id, {
        id: data.itinerary_id,
        cities: data.trip_summary.cities,
        totalCost: data.total_cost,
        createdAt: data.created_at,
      });
      setConfirmed(true);
      showToast("Lộ trình đã được lưu vào Lộ trình của tôi.", "success");
    } finally {
      setConfirming(false);
    }
  }

  // Shared by both the immediate check (right after pressing "Start") and
  // every subsequent watchPositionAsync update — checks the device's
  // current distance to whatever waypoint is current (by ref, so it always
  // sees the latest index even from a stale watcher closure), and if within
  // ARRIVAL_RADIUS_METERS marks that waypoint done and opens Maps for the
  // next one.
  function checkArrival(pos: { latitude: number; longitude: number }) {
    const current = waypoints[waypointIndexRef.current];
    if (!current?.coordinates) return;
    const dist = distanceMeters(
      { lat: pos.latitude, lng: pos.longitude },
      current.coordinates
    );
    if (dist > ARRIVAL_RADIUS_METERS) return;

    const nextIndex = waypointIndexRef.current + 1;
    waypointIndexRef.current = nextIndex;
    setWaypointIndex(nextIndex);
    if (user) setItineraryWaypointIndex(user.id, id, nextIndex).catch(() => {});

    const next = waypoints[nextIndex];
    if (next) {
      showToast(`Đã đến ${current.name} — đang chuyển hướng tới điểm tiếp theo.`, "success");
      openMapsFor(next);
    } else {
      showToast("Đã hoàn thành toàn bộ lộ trình!", "success");
      watchSubRef.current?.remove();
      watchSubRef.current = null;
    }
  }

  // Opens the phone's map app for the current waypoint and (re)starts GPS
  // watching — called both the first time the user starts the itinerary and
  // every time they tap the button again afterwards (resume after closing
  // Maps, app restart, etc.). Only watches while this screen is focused —
  // not a true background service (would need extra OS permissions/setup).
  async function startNavigation() {
    if (waypoints.length === 0) {
      showToast("Lịch trình này không có điểm GPS để chỉ đường.", "info");
      return;
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      showToast("Cần quyền vị trí để tự động chuyển điểm.", "error");
      return;
    }

    const target = waypoints[waypointIndexRef.current];
    if (target) openMapsFor(target);

    // Check immediately with the device's last-known/current fix instead of
    // waiting for watchPositionAsync's next update — if the user is already
    // standing at the first waypoint when they press "Start", this catches
    // it right away rather than only on the next 20m/10s movement tick.
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      checkArrival(pos.coords);
    } catch {}

    if (watchSubRef.current) return; // already watching
    watchSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
      (pos) => checkArrival(pos.coords)
    );
  }

  useEffect(() => {
    return () => {
      watchSubRef.current?.remove();
      watchSubRef.current = null;
    };
  }, []);

  // Trước đây lộ trình tự động được coi là "đang diễn ra" chỉ dựa vào ngày
  // tháng. Giờ chỉ chuyển sang "đang diễn ra" khi user bấm nút này — nếu
  // không bấm, lộ trình vẫn chỉ nằm trong "Lộ trình của tôi" ở trạng thái
  // đã lưu (xem cách "Lộ trình của tôi" chọn currentJourney trong itineraries.tsx).
  async function onStartItinerary() {
    if (!user) return;
    setStarting(true);
    try {
      if (!started) {
        await markItineraryStarted(user.id, id);
        setStarted(true);
        showToast("Lộ trình đang diễn ra.", "success");
      }
      await startNavigation();
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer backgroundColor={colors.surface}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <ActivityIndicator color={colors.navy} />
      </ScreenContainer>
    );
  }

  if (error || !data) {
    return (
      <ScreenContainer backgroundColor={colors.surface}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <ErrorBanner message={error ?? "Không tìm thấy lịch trình."} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {data.trip_summary.cities.join(" & ")}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.headerSubtitle}>
        Hành trình {data.trip_summary.trip_duration_days} ngày do DISA AI lên kế hoạch riêng cho bạn.
      </Text>

      {data.days.map((day, dayIdx) => (
        <View key={`${day.date}-${dayIdx}`} style={styles.daySection}>
          <Image source={getRegionImage(day.city)} style={styles.dayImage} contentFit="cover" />
          <View style={styles.dayHeaderRow}>
            <View style={styles.dayDot} />
            <Text style={styles.dayTitle}>
              Ngày {dayIdx + 1} · {day.city}
            </Text>
          </View>
          {day.activities.map((activity, idx) => (
            <Card key={idx} variant="elevated" style={styles.activityCard}>
              <View style={styles.activityHeaderRow}>
                <Text style={styles.activityTime}>
                  {activity.start_time} - {activity.end_time}
                </Text>
                <Text style={styles.activityCost}>{formatVnd(activity.cost)}</Text>
              </View>
              <View style={styles.activityNameRow}>
                <Text style={styles.activityName}>{activity.name}</Text>
                {isEditablePlace(activity) ? (
                  <Pressable
                    onPress={() => onEditActivity(activity)}
                    hitSlop={8}
                    style={styles.editButton}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.navy} />
                    <Text style={styles.editButtonText}>Sửa</Text>
                  </Pressable>
                ) : null}
              </View>
              {activity.activity ? (
                <Text style={styles.activityDescription}>{activity.activity}</Text>
              ) : null}
              <View style={styles.tagRow}>
                <Badge label={activityTypeLabel(activity.type)} tone="outline" />
                {activity.location ? <Badge label={activity.location} tone="neutral" /> : null}
              </View>
              {activity.type !== "transportation" && (photoTemplate || videoTemplate) ? (
                <View style={styles.missionSuggestRow}>
                  {photoTemplate ? (
                    <MissionChip
                      icon="camera-outline"
                      label="Chụp ảnh"
                      doneLabel="Đã nhận nhiệm vụ ảnh"
                      done={assignedKeys.has(`${activity.activity_id}:${MISSION_TYPE_PHOTO}`)}
                      loading={assigningKey === `${activity.activity_id}:${MISSION_TYPE_PHOTO}`}
                      onPress={() => onAssignMission(activity, photoTemplate, "Chụp ảnh")}
                    />
                  ) : null}
                  {videoTemplate ? (
                    <MissionChip
                      icon="videocam-outline"
                      label="Quay video"
                      doneLabel="Đã nhận nhiệm vụ video"
                      done={assignedKeys.has(`${activity.activity_id}:${MISSION_TYPE_VIDEO}`)}
                      loading={assigningKey === `${activity.activity_id}:${MISSION_TYPE_VIDEO}`}
                      onPress={() => onAssignMission(activity, videoTemplate, "Quay video")}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      ))}

      <Card style={styles.insightCard}>
        <View style={styles.insightHeaderRow}>
          <Ionicons name="sparkles" size={18} color={colors.gold} />
          <Text style={styles.insightTitle}>GỢI Ý TỪ AI GUIDE</Text>
        </View>
        <Text style={styles.insightText}>
          Gợi ý cho thời gian rảnh ở {data.trip_summary.cities[0]}: thử một quán ăn đặc sản địa
          phương và một quán trà truyền thống gần đó — hỏi AI Guide chat để biết thêm chi tiết.
        </Text>
      </Card>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tổng thời gian</Text>
          <Text style={styles.summaryValue}>{data.trip_summary.trip_duration_days} ngày</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Ngân sách</Text>
          <Text style={styles.summaryValue}>
            {formatVnd(data.trip_summary.planning_budget)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Chi phí ước tính</Text>
          <Text style={[styles.summaryValue, { color: colors.navy }]}>
            {formatVnd(data.total_cost)}
          </Text>
        </View>
        <Text style={styles.summaryNote}>
          Số tiền trên chỉ là ước tính, chưa phải thanh toán thật.
        </Text>
      </Card>

      <Button
        title={confirmed ? "Đã lưu vào Lộ trình của tôi" : "Xác nhận tạo lộ trình"}
        icon={confirmed ? "checkmark-circle" : undefined}
        onPress={onConfirmItinerary}
        loading={confirming}
        disabled={confirmed}
      />
      {confirmed ? (
        <Button
          title={started ? "Mở chỉ đường" : "Bắt đầu lộ trình"}
          variant={started ? "secondary" : "primary"}
          icon={started ? "navigate" : "play"}
          onPress={onStartItinerary}
          loading={starting}
        />
      ) : null}
      <Button title="Xóa lịch trình" variant="danger" onPress={onDelete} loading={deleting} />

      <Modal visible={!!editingActivity} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              Chọn địa điểm thay thế cho "{editingActivity?.name}"
            </Text>
            {loadingAlternatives ? (
              <ActivityIndicator color={colors.navy} style={{ marginVertical: spacing(3) }} />
            ) : (
              <FlatList
                data={alternatives}
                keyExtractor={(item, i) => `${item.name}-${i}`}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.altRow}
                    disabled={!!replacingActivityId}
                    onPress={() => onSelectAlternative(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.altName}>{item.name}</Text>
                      {item.activity ? <Text style={styles.altActivity}>{item.activity}</Text> : null}
                      {item.notes ? <Text style={styles.altNotes}>{item.notes}</Text> : null}
                      <View style={styles.altMetaRow}>
                        <Text style={styles.altCost}>{formatVnd(item.cost)}</Text>
                        {item.rating != null ? (
                          <View style={styles.altRatingRow}>
                            <Ionicons name="star" size={12} color={colors.gold} />
                            <Text style={styles.altRating}>{item.rating.toFixed(1)}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {replacingActivityId ? (
                      <ActivityIndicator color={colors.navy} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text style={styles.altEmptyText}>Không có gợi ý nào phù hợp.</Text>
                }
              />
            )}
            <Button title="Đóng" variant="ghost" onPress={() => setEditingActivity(null)} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: colors.navy },
  headerSubtitle: { color: colors.textMuted, fontSize: 13 },
  daySection: { gap: spacing(1) },
  dayImage: { width: "100%", height: 120, borderRadius: radius.lg },
  dayHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  dayDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  dayTitle: { fontSize: 16, fontWeight: "700", color: colors.navy },
  activityCard: { gap: spacing(0.5) },
  activityHeaderRow: { flexDirection: "row", justifyContent: "space-between" },
  activityTime: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  activityCost: { fontSize: 12, fontWeight: "700", color: colors.navy },
  activityName: { fontSize: 15, fontWeight: "700", color: colors.text },
  activityNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing(1) },
  editButton: { flexDirection: "row", alignItems: "center", gap: 2 },
  editButtonText: { fontSize: 12, fontWeight: "700", color: colors.navy },
  activityDescription: { fontSize: 12, color: colors.textMuted },
  tagRow: { flexDirection: "row", gap: spacing(0.75), flexWrap: "wrap" },
  missionSuggestRow: { flexDirection: "row", gap: spacing(0.75), marginTop: spacing(0.25) },
  missionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.navy,
  },
  missionChipDone: { borderColor: colors.success },
  missionChipText: { fontSize: 11, fontWeight: "700", color: colors.navy },
  missionChipTextDone: { color: colors.success },
  insightCard: { backgroundColor: colors.navyCard, borderWidth: 0, gap: spacing(1) },
  insightHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing(0.75) },
  insightTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  insightText: { color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 18 },
  summaryCard: { gap: spacing(0.75) },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  summaryNote: { color: colors.textMuted, fontSize: 11, fontStyle: "italic", marginTop: spacing(0.25) },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing(2.5),
    maxHeight: "75%",
    gap: spacing(1),
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  altRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    paddingVertical: spacing(1.25),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  altName: { fontSize: 14, fontWeight: "700", color: colors.text },
  altActivity: { fontSize: 12, color: colors.textMuted },
  altNotes: { fontSize: 11, color: colors.textMuted, fontStyle: "italic", marginTop: 2 },
  altMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), marginTop: spacing(0.5) },
  altCost: { fontSize: 12, fontWeight: "700", color: colors.navy },
  altRatingRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  altRating: { fontSize: 12, color: colors.textMuted },
  altEmptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: spacing(3) },
});
