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
import { BackHeader } from "@/components/BackHeader";
import { IconButton } from "@/components/IconButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Chip } from "@/components/Chip";
import { formatDate } from "@/utils/date";
import { haptics } from "@/utils/haptics";
import { useLocale, type TranslationKey } from "@/i18n/LocaleContext";
import {
  deleteItinerary,
  getActivityAlternatives,
  getItinerary,
  replaceActivity,
} from "@/api/endpoints/itinerary";
import {
  assignMission,
  deleteMissionsForTrip,
  listMissionTemplates,
  listUserMissions,
} from "@/api/endpoints/missions";
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

const ACTIVITY_TYPE_KEY: Record<string, TranslationKey> = {
  transportation: "itineraryDetail.typeTransportation",
  breakfast: "itineraryDetail.typeBreakfast",
  lunch: "itineraryDetail.typeLunch",
  dinner: "itineraryDetail.typeDinner",
  attraction: "itineraryDetail.typeAttraction",
  hotel: "itineraryDetail.typeHotel",
  shopping: "itineraryDetail.typeShopping",
  experience: "itineraryDetail.typeExperience",
  market: "itineraryDetail.typeMarket",
  coffee: "itineraryDetail.typeCoffee",
};

function activityTypeLabel(type: string, t: (key: TranslationKey) => string) {
  const key = ACTIVITY_TYPE_KEY[type];
  return key ? t(key) : type;
}

/** Compact VND for tight summary tiles: 12,5tr / 850k. */
function formatVndShort(n: number) {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
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
  releaseText,
  loadingText,
  icon = "camera-outline",
  disabled = false,
  loading = false,
}: {
  onSwipeSuccess: () => void;
  text: string;
  releaseText: string;
  loadingText: string;
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
          <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ opacity: 0.3 }} />
          <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ marginLeft: -8, opacity: 0.6 }} />
          <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ marginLeft: -8 }} />
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
        {loading || done ? loadingText : releaseText}
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
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.primary,
    borderRadius: 22,
  },
  text: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
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
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
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
  photoXp,
  videoXp,
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
  photoXp: number;
  videoXp: number;
  assigningPhoto: boolean;
  assigningVideo: boolean;
  onAssignPhoto: () => void;
  onAssignVideo: () => void;
  onEdit: () => void;
  onDirections: () => void;
}) {
  const { t } = useLocale();
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
            <Ionicons name="create-outline" size={15} color={colors.link} />
            <Text style={cardStyles.editText}>{t("itineraryDetail.edit")}</Text>
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
          <Text style={cardStyles.chipText}>{activityTypeLabel(activity.type, t)}</Text>
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
          <Text style={cardStyles.directionsText}>{t("itineraryDetail.directions")}</Text>
        </Pressable>
      )}

      {/* Inline Swipe Buttons directly on the card (no modal popups) */}
      {!isTransport && (
        <View style={cardStyles.missionContainer}>
          {/* Photo mission slider / status */}
          {photoAssigned ? (
            <View style={cardStyles.assignedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={cardStyles.assignedText}>{t("itineraryDetail.photoAssigned", { xp: photoXp })}</Text>
            </View>
          ) : (
            <SwipeButton
              icon="camera-outline"
              text={t("itineraryDetail.swipePhoto")}
              releaseText={t("itineraryDetail.releaseToAccept")}
              loadingText={t("itineraryDetail.accepting")}
              onSwipeSuccess={onAssignPhoto}
              loading={assigningPhoto}
            />
          )}

          {/* Video mission slider / status */}
          {videoAssigned ? (
            <View style={cardStyles.assignedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={cardStyles.assignedText}>{t("itineraryDetail.videoAssigned", { xp: videoXp })}</Text>
            </View>
          ) : (
            <SwipeButton
              icon="videocam-outline"
              text={t("itineraryDetail.swipeVideo")}
              releaseText={t("itineraryDetail.releaseToAccept")}
              loadingText={t("itineraryDetail.accepting")}
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(2),
    marginBottom: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.navy,
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
    color: colors.textMuted,
  },
  costText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
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
    color: colors.text,
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
    color: colors.primary,
  },
  descText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(0.75),
    marginTop: 2,
  },
  chip: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    borderRadius: radius.md,
    maxWidth: "90%",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successSoft,
    borderRadius: 14,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    marginVertical: 2,
  },
  assignedText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success,
  },
});

// ── Main Itinerary Detail Screen ─────────────────────────────────────────────

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { t, locale } = useLocale();

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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  // Missions already accepted on this trip — so the swipe sliders show
  // "accepted" after a reload instead of offering a duplicate.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      listUserMissions(user.id)
        .then((missions) => {
          if (cancelled) return;
          const keys = missions
            .filter((m) => m.tripId?.toLowerCase() === id.toLowerCase() && m.placeId)
            .map((m) => `${m.placeId!.toLowerCase()}:${m.type}`);
          setAssignedKeys((prev) => new Set([...prev, ...keys]));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [user, id])
  );

  const photoTemplate = templates.find(
    (tpl) => tpl.type === MISSION_TYPE_PHOTO && tpl.name === "Chụp ảnh kỷ niệm"
  );
  const videoTemplate = templates.find(
    (tpl) => tpl.type === MISSION_TYPE_VIDEO && tpl.name === "Quay video khám phá"
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
            setError(err instanceof ApiError ? err.message : t("itineraryDetail.loadFailed"))
        )
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [id, t])
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
    const key = `${activity.activity_id.toLowerCase()}:${template.type}`;
    const missionTitle = t("itineraryDetail.missionTitle", { label, place: activity.name });

    setAssigningKey(key);
    try {
      const target = await resolvePlaceCoords(activity, data.trip_summary.cities[0]);
      await assignMission({
        userId: user.id,
        tripId: data.itinerary_id,
        placeId: activity.activity_id,
        templateId: template.id,
        title: missionTitle,
        targetLatitude: target?.lat ?? null,
        targetLongitude: target?.lng ?? null,
      });
      setAssignedKeys((prev) => new Set(prev).add(key));
      haptics.success();
      showToast(`Đã nhận nhiệm vụ: ${label} tại ${activity.name} 🎯`, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("itineraryDetail.assignFailed"), "error");
    } finally {
      setAssigningKey(null);
    }
  }

  function onDelete() {
    Alert.alert(t("itineraryDetail.deleteTitle"), t("itineraryDetail.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
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
            showToast(err instanceof ApiError ? err.message : t("itineraryDetail.deleteFailed"), "error");
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
      showToast(err instanceof ApiError ? err.message : t("itineraryDetail.altLoadFailed"), "error");
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
      showToast(err instanceof ApiError ? err.message : t("itineraryDetail.replaceFailed"), "error");
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
      showToast(t("itineraryDetail.savedToast"), "success");
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
      showToast(t("itineraryDetail.arrivedToast", { place: current.name }), "success");
      openMapsFor(next);
    } else {
      showToast(t("itineraryDetail.finishedToast"), "success");
      watchSubRef.current?.remove();
      watchSubRef.current = null;
    }
  }

  async function startNavigation() {
    if (waypoints.length === 0) {
      showToast(t("itineraryDetail.noGps"), "info");
      return;
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      showToast(t("itineraryDetail.needLocation"), "error");
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
        showToast(t("itineraryDetail.startedToast"), "success");
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
      <View style={screenStyles.centered}>
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      // Swipe-back is disabled on this route, so the error state must keep a
      // visible way out.
      <ScreenContainer>
        <BackHeader title={t("itineraries.title")} onBack={() => router.back()} />
        <ErrorBanner message={error ?? t("itineraryDetail.notFound")} />
      </ScreenContainer>
    );
  }

  const city = data.trip_summary.cities[0] ?? "";
  const heroImage = getRegionImage(city);
  const visibleDays = data.days
    .map((day, dayIdx) => ({ day, dayIdx }))
    .filter(({ dayIdx }) => selectedDay === null || selectedDay === dayIdx);
  const nextWaypoint = waypoints[waypointIndex];

  return (
    <View style={screenStyles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing(1),
          // Room for the sticky action bar below.
          paddingBottom: insets.bottom + ACTION_BAR_HEIGHT + spacing(3),
          paddingHorizontal: spacing(2),
        }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[STICKY_DAY_CHIPS_INDEX]}
      >
        {/* 0 ── Header: back · title · delete ── */}
        <BackHeader
          title={data.trip_summary.cities.join(", ")}
          onBack={() => router.back()}
          right={
            <IconButton
              icon="trash-outline"
              color={colors.danger}
              onPress={onDelete}
              size={20}
            />
          }
        />

        {/* 1 ── Hero + trip summary ── */}
        <View>
          <Text style={screenStyles.subtitleText}>
            {t("itineraryDetail.subtitle", { days: data.trip_summary.trip_duration_days })}
          </Text>
          <View style={screenStyles.bannerContainer}>
            <Image source={heroImage} style={screenStyles.bannerImage} contentFit="cover" />
          </View>
          <View style={screenStyles.summaryCard}>
            <SummaryStat
              icon="calendar-outline"
              label={t("itineraryDetail.daysLabel")}
              value={String(data.trip_summary.trip_duration_days)}
            />
            <View style={screenStyles.summaryDivider} />
            <SummaryStat
              icon="location-outline"
              label={t("itineraryDetail.stops")}
              value={String(waypoints.length)}
            />
            <View style={screenStyles.summaryDivider} />
            <SummaryStat
              icon="wallet-outline"
              label={t("itineraryDetail.totalCost")}
              value={formatVndShort(data.total_cost)}
              hint={`${t("itineraryDetail.budget")} ${formatVndShort(data.trip_summary.budget)}`}
            />
          </View>
        </View>

        {/* 2 ── Day filter chips (sticky while scrolling) ── */}
        <View style={screenStyles.dayChipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={screenStyles.dayChips}>
            <Chip
              label={t("itineraryDetail.allDays")}
              selected={selectedDay === null}
              onPress={() => setSelectedDay(null)}
            />
            {data.days.map((day, dayIdx) => (
              <Chip
                key={`${day.date}-${dayIdx}`}
                label={t("itineraryDetail.dayShort", { n: dayIdx + 1 })}
                selected={selectedDay === dayIdx}
                onPress={() => setSelectedDay(dayIdx)}
              />
            ))}
          </ScrollView>
        </View>

        {/* 3 ── Days & activities ── */}
        <View>
          {visibleDays.map(({ day, dayIdx }) => (
            <View key={`${day.date}-${dayIdx}`} style={screenStyles.daySection}>
              <View style={screenStyles.dayHeaderRow}>
                <View style={screenStyles.dayDot} />
                <Text style={screenStyles.dayTitle}>
                  {t("itineraryDetail.day", { n: dayIdx + 1, city: day.city })}
                </Text>
                <Text style={screenStyles.dayDate}>{formatDate(day.date, locale)}</Text>
              </View>

              {day.activities.map((activity, idx) => {
                const photoKey = `${activity.activity_id.toLowerCase()}:${MISSION_TYPE_PHOTO}`;
                const videoKey = `${activity.activity_id.toLowerCase()}:${MISSION_TYPE_VIDEO}`;
                return (
                  <ActivityCard
                    key={`${activity.activity_id}-${idx}`}
                    activity={activity}
                    photoAssigned={assignedKeys.has(photoKey)}
                    videoAssigned={assignedKeys.has(videoKey)}
                    photoXp={photoTemplate?.rewardXP ?? 0}
                    videoXp={videoTemplate?.rewardXP ?? 0}
                    assigningPhoto={assigningKey === photoKey}
                    assigningVideo={assigningKey === videoKey}
                    onAssignPhoto={() =>
                      photoTemplate
                        ? handleAssignMission(activity, photoTemplate, t("itineraryDetail.photoLabel"))
                        : undefined
                    }
                    onAssignVideo={() =>
                      videoTemplate
                        ? handleAssignMission(activity, videoTemplate, t("itineraryDetail.videoLabel"))
                        : undefined
                    }
                    onEdit={() => onEditActivity(activity)}
                    onDirections={() => openMapsFor(activity, day.city)}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Sticky action bar: save → start → open directions ── */}
      <View style={[screenStyles.actionBar, { paddingBottom: insets.bottom + spacing(1.5) }]}>
        {confirmed && started ? (
          <Text style={screenStyles.nextStopText} numberOfLines={1}>
            {nextWaypoint
              ? t("itineraryDetail.nextStop", { place: nextWaypoint.name })
              : t("itineraryDetail.tripDone")}
          </Text>
        ) : null}
        {!confirmed ? (
          <Button
            title={t("itineraryDetail.save")}
            icon="bookmark-outline"
            onPress={onConfirmItinerary}
            loading={confirming}
          />
        ) : (
          <Button
            title={started ? t("itineraryDetail.openDirections") : t("itineraryDetail.start")}
            icon={started ? "navigate" : "play"}
            onPress={onStartItinerary}
            loading={starting}
          />
        )}
      </View>

      {deleting ? (
        <View style={screenStyles.deletingOverlay}>
          <ActivityIndicator color={colors.primaryText} size="large" />
        </View>
      ) : null}

      {/* ── Replace Activity Modal ── */}
      <Modal
        visible={!!editingActivity}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingActivity(null)}
      >
        <View style={screenStyles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingActivity(null)} />
          <View style={screenStyles.editModalSheet}>
            <Text style={screenStyles.modalTitle}>
              {t("itineraryDetail.altTitle", { name: editingActivity?.name ?? "" })}
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
                  <Text style={screenStyles.altEmptyText}>{t("itineraryDetail.noAlternatives")}</Text>
                }
              />
            )}
            <Button title={t("common.close")} variant="ghost" onPress={() => setEditingActivity(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View style={screenStyles.summaryStat}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <Text style={screenStyles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={screenStyles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={screenStyles.summaryHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// Index of the day-chip row among the ScrollView's direct children
// (header, hero+summary, chips, days) — it sticks under the top edge.
const STICKY_DAY_CHIPS_INDEX = 2;
const ACTION_BAR_HEIGHT = 72;

const screenStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitleText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing(0.5),
    marginBottom: spacing(2),
  },
  bannerContainer: {
    height: 150,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  // Overlaps the bottom of the banner, like the voucher detail's floating icon.
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandNavy,
    borderRadius: radius.lg,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(1),
    marginTop: -spacing(4),
    marginHorizontal: spacing(1.5),
    ...shadow,
  },
  summaryStat: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  summaryLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  summaryHint: { color: "rgba(255,255,255,0.55)", fontSize: 10 },
  summaryDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.15)" },
  dayChipsWrap: {
    backgroundColor: colors.background,
    paddingVertical: spacing(1.25),
    marginHorizontal: -spacing(2),
    marginTop: spacing(1),
  },
  dayChips: { gap: spacing(1), paddingHorizontal: spacing(2) },
  daySection: {
    marginTop: spacing(1),
    marginBottom: spacing(1),
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
    backgroundColor: colors.gold,
  },
  dayTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy,
  },
  dayDate: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing(1.5),
    paddingHorizontal: spacing(2),
    gap: spacing(1),
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow,
  },
  nextStopText: { fontSize: 12, fontWeight: "600", color: colors.textMuted, textAlign: "center" },
  deletingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(8,29,64,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  editModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing(2.5),
    maxHeight: "75%",
    gap: spacing(1),
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  altRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing(1.25),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  altName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  altActivity: {
    fontSize: 12,
    color: colors.textMuted,
  },
  altCost: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.link,
    marginTop: 2,
  },
  altEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: spacing(3),
  },
});
