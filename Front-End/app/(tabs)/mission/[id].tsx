import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getUserMission, submitMission } from "@/api/endpoints/missions";
import { ApiError } from "@/api/http";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { consumePendingCapturedPhoto, consumePendingCapturedVideo } from "@/utils/pendingCapture";
import { MISSION_STATUS_LABEL, UserMission } from "@/types/missions";
import { useToast } from "@/context/ToastContext";
import { colors, radius, spacing } from "@/theme/colors";

// Mission.Instructions/badge-name/hero-image are all mock/generic below —
// UserMission has no free-text description/image fields, so per-mission
// specifics beyond photo/video/location requirements can't be rendered
// without inventing fake data.
const GENERIC_INSTRUCTIONS = [
  "Reach the mission location shown by your AI Guide.",
  "Capture a photo or short video as evidence (or check in with your location).",
  "Submit — the mission completes and rewards are credited right away.",
];

const COMPLETED_STATUS = 2;

// Must match MissionSubmissionService.MaxDistanceMeters — the server is the
// real check; this just avoids uploading a photo/video that will be rejected.
const MAX_DISTANCE_METERS = 1000;

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export default function MissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [mission, setMission] = useState<UserMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasLoadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Only show the full-screen spinner on the very first load — refocusing
      // after camera.tsx (router.back()) would otherwise blank out the just
      // captured photo preview while this refetch is in flight. A ref (not
      // `mission` state) tracks this so the check always sees the latest
      // value regardless of this callback's memoized closure.
      if (!hasLoadedRef.current) setLoading(true);
      setError(null);
      getUserMission(id)
        .then((res) => {
          if (cancelled) return;
          setMission(res);
          hasLoadedRef.current = true;
        })
        .catch(
          (err) =>
            !cancelled &&
            setError(err instanceof ApiError ? err.message : "Không tải được nhiệm vụ.")
        )
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  // Picks up a photo captured on mission/camera.tsx, if any.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingCapturedPhoto();
      if (pending) setPhotoUri(pending);
    }, [])
  );

  // Picks up a video captured on mission/record.tsx, if any.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingCapturedVideo();
      if (pending) {
        setVideoUri(pending.uri);
        setVideoDuration(pending.durationSec);
      }
    }, [])
  );

  function openCamera() {
    router.push({
      pathname: "/(tabs)/mission/camera",
      params: { missionTitle: mission?.title ?? "Nhiệm vụ" },
    });
  }

  function openRecorder() {
    router.push({
      pathname: "/(tabs)/mission/record",
      params: {
        missionTitle: mission?.title ?? "Nhiệm vụ",
        minSeconds: mission?.minVideoSeconds ? String(mission.minVideoSeconds) : undefined,
      },
    });
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast("Thiếu quyền — cần quyền truy cập thư viện ảnh.", "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  const target =
    mission?.targetLatitude != null && mission?.targetLongitude != null
      ? { lat: mission.targetLatitude, lng: mission.targetLongitude }
      : null;
  const distance = coords && target ? distanceMeters(coords, target) : null;

  async function getCurrentCoords() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      showToast("Thiếu quyền — cần quyền vị trí để xác minh nhiệm vụ.", "error");
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const next = { lat: loc.coords.latitude, lng: loc.coords.longitude };
    setCoords(next);
    return next;
  }

  async function checkLocation() {
    setLocating(true);
    try {
      const here = await getCurrentCoords();
      if (!here || !target) return;
      const d = distanceMeters(here, target);
      if (d <= MAX_DISTANCE_METERS) {
        showToast("Vị trí hợp lệ — bạn đang ở địa điểm nhiệm vụ.", "success");
      } else {
        showToast(`Vị trí không hợp lệ — bạn đang cách địa điểm ${formatDistance(d)}.`, "error");
      }
    } catch {
      showToast("Không lấy được vị trí hiện tại.", "error");
    } finally {
      setLocating(false);
    }
  }

  async function onSubmit() {
    if (!mission) return;
    setSubmitting(true);
    try {
      // Always a fresh fix — a position checked earlier may be stale.
      let here: { lat: number; lng: number } | null = null;
      try {
        here = await getCurrentCoords();
      } catch {}
      if (target) {
        if (!here) {
          showToast("Cần vị trí hiện tại để xác minh nhiệm vụ.", "error");
          return;
        }
        const d = distanceMeters(here, target);
        if (d > MAX_DISTANCE_METERS) {
          showToast(
            `Vị trí không hợp lệ — bạn đang cách địa điểm ${formatDistance(d)}. Nhiệm vụ chưa hoàn thành.`,
            "error"
          );
          return;
        }
      }
      await submitMission({
        userMissionId: id,
        photoUri,
        videoUri,
        latitude: here?.lat,
        longitude: here?.lng,
        takenAt: new Date().toISOString(),
      });
      showToast(`Hoàn thành nhiệm vụ! +${mission.rewardXP} XP · +${mission.rewardCoins} Coin`, "success");
      router.back();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không thể nộp minh chứng.", "error");
    } finally {
      setSubmitting(false);
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

  if (error || !mission) {
    return (
      <ScreenContainer backgroundColor={colors.surface}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <ErrorBanner message={error ?? "Không tìm thấy nhiệm vụ."} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll noPadding backgroundColor={colors.surface}>
      <View style={styles.hero}>
        <Image
          source={{ uri: `https://picsum.photos/seed/disa-mission-${mission.id}/900/500` }}
          style={styles.heroImage}
          contentFit="cover"
        />
        <View style={[styles.heroOverlay, { top: insets.top + spacing(1.5) }]}>
          <IconButton icon="arrow-back" variant="glass" onPress={() => router.back()} />
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <Badge label="Medium Difficulty" tone="primary" />
          <Badge label={`${mission.rewardXP + mission.rewardCoins} pts`} tone="gold" />
        </View>

        <Text style={styles.title}>{mission.title}</Text>
        <Badge label={MISSION_STATUS_LABEL[mission.status] ?? "—"} tone="outline" />

        <Card style={styles.instructionsCard}>
          <View style={styles.instructionsHeaderRow}>
            <Ionicons name="information-circle-outline" size={18} color={colors.navy} />
            <Text style={styles.instructionsTitle}>Mission Instructions</Text>
          </View>
          {GENERIC_INSTRUCTIONS.map((step, idx) => (
            <View key={idx} style={styles.instructionRow}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>{idx + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{step}</Text>
            </View>
          ))}
        </Card>

        <View style={styles.rewardRow}>
          <Card style={styles.rewardCard}>
            <Ionicons name="medal-outline" size={20} color={colors.gold} />
            <Text style={styles.rewardLabel}>BADGE EARNED</Text>
            <Text style={styles.rewardValue}>Explorer</Text>
          </Card>
          <Card style={styles.rewardCard}>
            <Ionicons name="gift-outline" size={20} color={colors.navy} />
            <Text style={styles.rewardLabel}>BONUS REWARD</Text>
            <Text style={styles.rewardValue}>
              +{mission.rewardXP} XP · +{mission.rewardCoins} Coin
            </Text>
          </Card>
        </View>

        {mission.status !== COMPLETED_STATUS ? (
          <Card style={styles.submitCard}>
            <Text style={styles.submitTitle}>Nộp minh chứng</Text>

            {videoUri ? (
              <View style={styles.videoPreview}>
                <Ionicons name="videocam" size={28} color={colors.navy} />
                <Text style={styles.videoPreviewText}>Video đã quay ({videoDuration}s)</Text>
              </View>
            ) : photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
            ) : (
              <View style={styles.interactivePlaceholder}>
                <Text style={styles.interactivePlaceholderText}>Interactive View</Text>
              </View>
            )}

            <View style={styles.submitButtonRow}>
              {mission.requiresPhoto ? (
                <>
                  <Button title="Chụp ảnh" variant="secondary" icon="camera-outline" onPress={openCamera} style={{ flex: 1 }} />
                  <Button title="Chọn từ thư viện" variant="secondary" icon="images-outline" onPress={pickFromLibrary} style={{ flex: 1 }} />
                </>
              ) : null}
              {mission.requiresVideo ? (
                <Button
                  title={videoUri ? "Quay lại" : "Quay video"}
                  variant="secondary"
                  icon="videocam-outline"
                  onPress={openRecorder}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>

            <Button
              title={
                distance != null
                  ? distance <= MAX_DISTANCE_METERS
                    ? `Vị trí hợp lệ · cách ${formatDistance(distance)}`
                    : `Vị trí không hợp lệ · cách ${formatDistance(distance)}`
                  : coords
                    ? `Vị trí: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                    : "Kiểm tra vị trí"
              }
              variant="ghost"
              icon={
                distance != null && distance > MAX_DISTANCE_METERS
                  ? "close-circle-outline"
                  : distance != null
                    ? "checkmark-circle-outline"
                    : "location-outline"
              }
              loading={locating}
              onPress={checkLocation}
            />

            <Button
              title="Nộp minh chứng"
              onPress={onSubmit}
              loading={submitting}
              disabled={(mission.requiresPhoto && !photoUri) || (mission.requiresVideo && !videoUri)}
            />
          </Card>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220 },
  heroImage: StyleSheet.absoluteFill,
  heroOverlay: { position: "absolute", left: spacing(2.5) },
  body: { padding: spacing(2.5), gap: spacing(1.5) },
  badgeRow: { flexDirection: "row", gap: spacing(1) },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  instructionsCard: { gap: spacing(1) },
  instructionsHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing(0.75) },
  instructionsTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  instructionRow: { flexDirection: "row", gap: spacing(1), alignItems: "flex-start" },
  instructionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.navyCard,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionNumberText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  instructionText: { flex: 1, fontSize: 13, color: colors.textMuted },
  rewardRow: { flexDirection: "row", gap: spacing(1.5) },
  rewardCard: { flex: 1, alignItems: "center", gap: 2 },
  rewardLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },
  rewardValue: { fontSize: 13, fontWeight: "700", color: colors.text },
  submitCard: { gap: spacing(1) },
  submitTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  photoPreview: { width: "100%", height: 180, borderRadius: radius.md },
  videoPreview: {
    width: "100%",
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(0.5),
  },
  videoPreviewText: { color: colors.navy, fontSize: 13, fontWeight: "700" },
  interactivePlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  interactivePlaceholderText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  submitButtonRow: { flexDirection: "row", gap: spacing(1) },
});
