import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
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
import { colors, radius, shadow, spacing } from "@/theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isEditablePlace(activity: Activity) {
  return activity.type !== "transportation";
}

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

function activityTypeLabel(type: string) {
  return ACTIVITY_TYPE_LABEL[type] ?? type;
}

function formatVnd(n: number) {
  if (n === 0) return "0 VND";
  return `${Math.round(n).toLocaleString("vi-VN")} VND`;
}

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

function openMapsFor(activity: Activity, city?: string) {
  // Prefer server-geocoded GPS; otherwise let Google Maps search by name +
  // area (meals/coffee are never geocoded, hotel names often miss).
  const destination = activity.coordinates
    ? `${activity.coordinates.lat},${activity.coordinates.lng}`
    : encodeURIComponent([activity.name, activity.location ?? city].filter(Boolean).join(", "));
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
}

// GPS the mission's submission is checked against. Server-geocoded coords
// when the itinerary has them; otherwise the device geocoder (Google on
// Android, Apple on iOS) on name + area. Null if the place can't be found.
async function resolvePlaceCoords(
  activity: Activity,
  city?: string
): Promise<{ lat: number; lng: number } | null> {
  if (activity.coordinates) return activity.coordinates;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const query = [activity.name, activity.location ?? city].filter(Boolean).join(", ");
    const [hit] = await Location.geocodeAsync(query);
    return hit ? { lat: hit.latitude, lng: hit.longitude } : null;
  } catch {
    return null;
  }
}

// ── Inline Swipe Button Component (Rendered directly on cards) ───────────────

function SwipeButton({
  onSwipeSuccess,
  text,
  icon = "camera-outline",
  disabled = false,
  loading = false,
}: {
  onSwipeSuccess: () => void;
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [done, setDone] = useState(false);
  const pan = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const isCompleted = useRef(false);

  const thumbSize = 38;
  const padding = 3;
  const maxTranslate = Math.max(0, containerWidth - thumbSize - padding * 2);

  // PanResponder is created once, so read live values through refs to avoid
  // stale closures (width is 0 on the first render).
  const maxRef = useRef(0);
  maxRef.current = maxTranslate;
  const blockedRef = useRef(false);
  blockedRef.current = disabled || loading;
  const successRef = useRef(onSwipeSuccess);
  successRef.current = onSwipeSuccess;

  // If the request finished but the button is still mounted (e.g. error), reset it.
  useEffect(() => {
    if (loading || !isCompleted.current) return;
    const t = setTimeout(() => {
      isCompleted.current = false;
      setDone(false);
      Animated.spring(pan, { toValue: 0, friction: 7, useNativeDriver: false }).start();
    }, 600);
    return () => clearTimeout(t);
  }, [loading, pan]);

  const releasePress = () =>
    Animated.spring(press, { toValue: 0, friction: 5, useNativeDriver: false }).start();
  const springBack = () =>
    Animated.spring(pan, { toValue: 0, friction: 6, tension: 60, useNativeDriver: false }).start();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !blockedRef.current && !isCompleted.current,
      onMoveShouldSetPanResponder: (_, g) =>
        !blockedRef.current && !isCompleted.current && Math.abs(g.dx) > Math.abs(g.dy),
      // Keep the parent ScrollView from stealing the gesture mid-swipe.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        Animated.spring(press, { toValue: 1, friction: 5, useNativeDriver: false }).start();
      },
      onPanResponderMove: (_, g) => {
        if (isCompleted.current) return;
        pan.setValue(Math.max(0, Math.min(g.dx, maxRef.current)));
      },
      onPanResponderRelease: (_, g) => {
        releasePress();
        if (isCompleted.current) return;
        const max = maxRef.current;
        if (max > 0 && (g.dx >= max * 0.75 || (g.vx > 1.2 && g.dx > max * 0.4))) {
          isCompleted.current = true;
          Animated.timing(pan, { toValue: max, duration: 140, useNativeDriver: false }).start(() => {
            setDone(true);
            successRef.current();
          });
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: () => {
        releasePress();
        if (!isCompleted.current) springBack();
      },
    })
  ).current;

  const range = maxTranslate || 1;
  const progress = pan.interpolate({
    inputRange: [0, range],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[swipeStyles.container, disabled && { opacity: 0.5 }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Filled trail behind the thumb */}
      <Animated.View
        style={[
          swipeStyles.fill,
          {
            width: pan.interpolate({
              inputRange: [0, range],
              outputRange: [thumbSize + padding * 2, containerWidth],
              extrapolate: "clamp",
            }),
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
          },
        ]}
      />

      {/* Label fades and drifts right as the user drags */}
      <Animated.Text
        numberOfLines={1}
        style={[
          swipeStyles.text,
          {
            opacity: progress.interpolate({
              inputRange: [0, 0.5],
              outputRange: [1, 0],
              extrapolate: "clamp",
            }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) },
            ],
          },
        ]}
      >
        {text}
      </Animated.Text>

      {/* Static ››› hint at the end of the track, hidden once the user drags */}
      {!done && (
        <Animated.View
          pointerEvents="none"
          style={[
            swipeStyles.chevrons,
            {
              opacity: progress.interpolate({
                inputRange: [0, 0.3],
                outputRange: [1, 0],
                extrapolate: "clamp",
              }),
            },
          ]}
        >
          <Ionicons name="chevron-forward" size={14} color="#0284C7" style={{ opacity: 0.3 }} />
          <Ionicons name="chevron-forward" size={14} color="#0284C7" style={{ marginLeft: -8, opacity: 0.6 }} />
          <Ionicons name="chevron-forward" size={14} color="#0284C7" style={{ marginLeft: -8 }} />
        </Animated.View>
      )}

      {/* Prompt revealed on the filled trail near the end */}
      <Animated.Text
        pointerEvents="none"
        style={[
          swipeStyles.releaseText,
          {
            opacity: progress.interpolate({
              inputRange: [0.55, 1],
              outputRange: [0, 1],
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        {loading || done ? "Đang nhận nhiệm vụ..." : "Thả tay để nhận"}
      </Animated.Text>

      <Animated.View
        {...panResponder.panHandlers}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[
          swipeStyles.thumb,
          {
            transform: [
              { translateX: pan },
              { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
            ],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : done ? (
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
        ) : (
          <Ionicons name={icon} size={18} color="#FFFFFF" />
        )}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  container: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    marginVertical: 3,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#0284C7",
    borderRadius: 22,
  },
  text: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    paddingHorizontal: 44,
  },
  chevrons: {
    position: "absolute",
    right: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  releaseText: {
    position: "absolute",
    left: 0,
    right: 44,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  thumb: {
    position: "absolute",
    left: 3,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0284C7",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
});

// ── Activity Row Card (With Inline Swipe Buttons directly on the card) ───────

function ActivityCard({
  activity,
  photoAssigned,
  videoAssigned,
  assigningPhoto,
  assigningVideo,
  onAssignPhoto,
  onAssignVideo,
  onEdit,
  onDirections,
}: {
  activity: Activity;
  photoAssigned: boolean;
  videoAssigned: boolean;
  assigningPhoto: boolean;
  assigningVideo: boolean;
  onAssignPhoto: () => void;
  onAssignVideo: () => void;
  onEdit: () => void;
  onDirections: () => void;
}) {
  const isTransport = activity.type === "transportation";

  return (
    <View style={cardStyles.card}>
      {/* Header line: Time & Cost */}
      <View style={cardStyles.headerRow}>
        <Text style={cardStyles.timeText}>
          {activity.start_time} - {activity.end_time}
        </Text>
        <Text style={cardStyles.costText}>{formatVnd(activity.cost)}</Text>
      </View>

      {/* Title line: Name & Edit button */}
      <View style={cardStyles.titleRow}>
        <Text style={cardStyles.nameText} numberOfLines={2}>
          {activity.name}
        </Text>
        {isEditablePlace(activity) && (
          <Pressable style={cardStyles.editBtn} onPress={onEdit} hitSlop={8}>
            <Ionicons name="create-outline" size={15} color="#0284c7" />
            <Text style={cardStyles.editText}>Sửa</Text>
          </Pressable>
        )}
      </View>

      {/* Description */}
      {activity.activity ? (
        <Text style={cardStyles.descText}>{activity.activity}</Text>
      ) : null}

      {/* Tag pills */}
      <View style={cardStyles.tagRow}>
        <View style={cardStyles.chip}>
          <Text style={cardStyles.chipText}>{activityTypeLabel(activity.type)}</Text>
        </View>
        {activity.location ? (
          <View style={cardStyles.chip}>
            <Text style={cardStyles.chipText} numberOfLines={1}>
              {activity.location}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Directions to this place (transport rows are movements, not places) */}
      {!isTransport && (
        <Pressable
          style={({ pressed }) => [cardStyles.directionsBtn, pressed && { opacity: 0.7 }]}
          onPress={onDirections}
        >
          <Ionicons name="navigate" size={16} color="#FFFFFF" />
          <Text style={cardStyles.directionsText}>Chỉ đường</Text>
        </Pressable>
      )}

      {/* Inline Swipe Buttons directly on the card (no modal popups) */}
      {!isTransport && (
        <View style={cardStyles.missionContainer}>
          {/* Photo mission slider / status */}
          {photoAssigned ? (
            <View style={cardStyles.assignedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={cardStyles.assignedText}>Đã nhận nhiệm vụ Chụp ảnh (+50 XP)</Text>
            </View>
          ) : (
            <SwipeButton
              icon="camera-outline"
              text="Trượt để nhận nhiệm vụ chụp ảnh"
              onSwipeSuccess={onAssignPhoto}
              loading={assigningPhoto}
            />
          )}

          {/* Video mission slider / status */}
          {videoAssigned ? (
            <View style={cardStyles.assignedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={cardStyles.assignedText}>Đã nhận nhiệm vụ Quay video (+50 XP)</Text>
            </View>
          ) : (
            <SwipeButton
              icon="videocam-outline"
              text="Trượt để nhận nhiệm vụ quay video"
              onSwipeSuccess={onAssignVideo}
              loading={assigningVideo}
            />
          )}
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: spacing(2),
    marginBottom: spacing(1.5),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: spacing(0.75),
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  costText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing(1),
  },
  nameText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 22,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingTop: 2,
  },
  editText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284c7",
  },
  descText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(0.75),
    marginTop: 2,
  },
  chip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    borderRadius: radius.md,
    maxWidth: "90%",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0284C7",
    borderRadius: 14,
    paddingVertical: spacing(1),
    marginTop: spacing(0.75),
  },
  directionsText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  missionContainer: {
    marginTop: spacing(0.75),
    gap: 4,
  },
  assignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    marginVertical: 2,
  },
  assignedText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#16A34A",
  },
});

// ── Main Itinerary Detail Screen ─────────────────────────────────────────────

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

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

  async function handleAssignMission(
    activity: Activity,
    template: MissionTemplate,
    label: string
  ) {
    if (!user || !data) return;
    const key = `${activity.activity_id}:${template.type}`;

    setAssigningKey(key);
    try {
      const target = await resolvePlaceCoords(activity, data.trip_summary.cities[0]);
      await assignMission({
        userId: user.id,
        tripId: data.itinerary_id,
        placeId: activity.activity_id,
        templateId: template.id,
        title: `${label} tại ${activity.name}`,
        targetLatitude: target?.lat ?? null,
        targetLongitude: target?.lng ?? null,
      });
      setAssignedKeys((prev) => new Set(prev).add(key));
      showToast(`Đã nhận nhiệm vụ: ${label} tại ${activity.name} 🎯`, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không thể giao nhiệm vụ.", "error");
    } finally {
      setAssigningKey(null);
    }
  }

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

  function checkArrival(pos: { latitude: number; longitude: number }) {
    const current = waypoints[waypointIndexRef.current];
    if (!current?.coordinates) return;
    const dist = distanceMeters({ lat: pos.latitude, lng: pos.longitude }, current.coordinates);
    if (dist > ARRIVAL_RADIUS_METERS) return;
    const nextIndex = waypointIndexRef.current + 1;
    waypointIndexRef.current = nextIndex;
    setWaypointIndex(nextIndex);
    if (user) setItineraryWaypointIndex(user.id, id, nextIndex).catch(() => {});
    const next = waypoints[nextIndex];
    if (next) {
      showToast(`Đã đến ${current.name} — chuyển hướng tới điểm tiếp theo.`, "success");
      openMapsFor(next);
    } else {
      showToast("Đã hoàn thành toàn bộ lộ trình!", "success");
      watchSubRef.current?.remove();
      watchSubRef.current = null;
    }
  }

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
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      checkArrival(pos.coords);
    } catch {}
    if (watchSubRef.current) return;
    watchSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
      (pos) => checkArrival(pos.coords)
    );
  }

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

  useEffect(() => {
    return () => {
      watchSubRef.current?.remove();
      watchSubRef.current = null;
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <ScreenContainer backgroundColor="#F8FAFC">
        <ErrorBanner message={error ?? "Không tìm thấy lịch trình."} />
      </ScreenContainer>
    );
  }

  const city = data.trip_summary.cities[0] ?? "";
  const heroImage = getRegionImage(city);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing(1),
          paddingBottom: insets.bottom + spacing(4),
          paddingHorizontal: spacing(2),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Header Row (Back arrow, Title) ── */}
        <View style={screenStyles.headerRow}>
          <Pressable style={screenStyles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <Text style={screenStyles.headerTitle} numberOfLines={1}>
            {data.trip_summary.cities.join(", ")}
          </Text>
          {/* Spacer keeps the title centered opposite the back button */}
          <View style={screenStyles.headerSpacer} />
        </View>

        {/* ── Subheader ── */}
        <Text style={screenStyles.subtitleText}>
          Hành trình {data.trip_summary.trip_duration_days} ngày do DISA AI lên kế hoạch riêng cho bạn.
        </Text>

        {/* ── Hero Image Banner ── */}
        <View style={screenStyles.bannerContainer}>
          <Image source={heroImage} style={screenStyles.bannerImage} contentFit="cover" />
        </View>

        {/* ── Days & Activities ── */}
        {data.days.map((day, dayIdx) => (
          <View key={`${day.date}-${dayIdx}`} style={screenStyles.daySection}>
            {/* Day Header */}
            <View style={screenStyles.dayHeaderRow}>
              <View style={screenStyles.dayDot} />
              <Text style={screenStyles.dayTitle}>
                Ngày {dayIdx + 1} · {day.city}
              </Text>
            </View>

            {/* Activity Cards */}
            {day.activities.map((activity, idx) => {
              const photoKey = `${activity.activity_id}:${MISSION_TYPE_PHOTO}`;
              const videoKey = `${activity.activity_id}:${MISSION_TYPE_VIDEO}`;
              return (
                <ActivityCard
                  key={`${activity.activity_id}-${idx}`}
                  activity={activity}
                  photoAssigned={assignedKeys.has(photoKey)}
                  videoAssigned={assignedKeys.has(videoKey)}
                  assigningPhoto={assigningKey === photoKey}
                  assigningVideo={assigningKey === videoKey}
                  onAssignPhoto={() =>
                    photoTemplate
                      ? handleAssignMission(activity, photoTemplate, "Chụp ảnh")
                      : undefined
                  }
                  onAssignVideo={() =>
                    videoTemplate
                      ? handleAssignMission(activity, videoTemplate, "Quay video")
                      : undefined
                  }
                  onEdit={() => onEditActivity(activity)}
                  onDirections={() => openMapsFor(activity, day.city)}
                />
              );
            })}
          </View>
        ))}

        {/* ── Actions Row (Save / Start) ── */}
        <View style={screenStyles.actionSection}>
          {!confirmed ? (
            <Button
              title="Lưu lịch trình này"
              icon="bookmark-outline"
              onPress={onConfirmItinerary}
              loading={confirming}
            />
          ) : (
            <Button
              title="Đã lưu vào lộ trình"
              icon="checkmark-circle"
              variant="secondary"
              onPress={() => {}}
              disabled
            />
          )}
          {confirmed && (
            <Button
              title={started ? "Mở chỉ đường" : "Bắt đầu lộ trình"}
              icon={started ? "navigate" : "play"}
              variant={started ? "secondary" : "primary"}
              onPress={onStartItinerary}
              loading={starting}
            />
          )}
          <Button
            title="Xóa lịch trình"
            variant="danger"
            icon="trash-outline"
            onPress={onDelete}
            loading={deleting}
          />
        </View>
      </ScrollView>

      {/* ── Replace Activity Modal ── */}
      <Modal visible={!!editingActivity} animationType="slide" transparent>
        <View style={screenStyles.modalBackdrop}>
          <View style={screenStyles.editModalSheet}>
            <Text style={screenStyles.modalTitle}>
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
                    style={screenStyles.altRow}
                    disabled={!!replacingActivityId}
                    onPress={() => onSelectAlternative(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={screenStyles.altName}>{item.name}</Text>
                      {item.activity ? (
                        <Text style={screenStyles.altActivity}>{item.activity}</Text>
                      ) : null}
                      <Text style={screenStyles.altCost}>{formatVnd(item.cost)}</Text>
                    </View>
                    {replacingActivityId ? (
                      <ActivityIndicator color={colors.navy} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text style={screenStyles.altEmptyText}>Không có gợi ý nào phù hợp.</Text>
                }
              />
            )}
            <Button title="Đóng" variant="ghost" onPress={() => setEditingActivity(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const screenStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing(1),
  },
  backBtn: {
    padding: spacing(0.5),
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: spacing(1),
  },
  headerSpacer: {
    width: 32,
  },
  subtitleText: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: spacing(2),
  },
  bannerContainer: {
    height: 150,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: spacing(2.5),
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  daySection: {
    marginBottom: spacing(2),
  },
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    marginBottom: spacing(1.5),
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0B2D5B",
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B2D5B",
  },
  actionSection: {
    gap: spacing(1.25),
    marginTop: spacing(1),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  editModalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing(2.5),
    maxHeight: "75%",
    gap: spacing(1),
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  altRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing(1.25),
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  altName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  altActivity: {
    fontSize: 12,
    color: "#64748B",
  },
  altCost: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
    marginTop: 2,
  },
  altEmptyText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: spacing(3),
  },
});
