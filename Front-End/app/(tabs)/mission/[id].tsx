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
import {
  MISSION_STATUS_KEY,
  MISSION_TYPE_KEY,
  MISSION_TYPE_PHOTO,
  UserMission,
} from "@/types/missions";
import { getRegionImage } from "@/data/regionImages";
import { useToast } from "@/context/ToastContext";
import { useLocale } from "@/i18n/LocaleContext";
import { formatDate } from "@/utils/date";
import { haptics } from "@/utils/haptics";
import { colors, radius, spacing } from "@/theme/colors";

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

/** Mission titles are "<action> tại <place>" (see itinerary/[id].tsx) — the
 * place name picks a matching region photo when we have one. */
function placeFromTitle(title: string) {
  const match = title.match(/\s(?:tại|at)\s(.+)$/i);
  return match ? match[1] : title;
}

export default function MissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { t, locale } = useLocale();
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
            setError(err instanceof ApiError ? err.message : t("missionDetail.loadFailed"))
        )
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [id, t])
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
      params: { missionTitle: mission?.title ?? t("missionDetail.fallbackTitle") },
    });
  }

  function openRecorder() {
    router.push({
      pathname: "/(tabs)/mission/record",
      params: {
        missionTitle: mission?.title ?? t("missionDetail.fallbackTitle"),
        minSeconds: mission?.minVideoSeconds ? String(mission.minVideoSeconds) : undefined,
      },
    });
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast(t("missionDetail.libraryPermission"), "error");
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
      showToast(t("missionDetail.locationPermission"), "error");
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
        showToast(t("missionDetail.locationOk"), "success");
      } else {
        showToast(t("missionDetail.locationFar", { distance: formatDistance(d) }), "error");
      }
    } catch {
      showToast(t("missionDetail.locationFailed"), "error");
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
          showToast(t("missionDetail.needLocation"), "error");
          return;
        }
        const d = distanceMeters(here, target);
        if (d > MAX_DISTANCE_METERS) {
          showToast(t("missionDetail.locationFarSubmit", { distance: formatDistance(d) }), "error");
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
      haptics.success();
      showToast(
        t("missionDetail.completedToast", { xp: mission.rewardXP, coins: mission.rewardCoins }),
        "success"
      );
      router.back();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("missionDetail.submitFailed"), "error");
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
        <ErrorBanner message={error ?? t("missionDetail.notFound")} />
      </ScreenContainer>
    );
  }

  const completed = mission.status === COMPLETED_STATUS;
  // The submitted photo is the best hero once there is one; otherwise a
  // photo of the mission's place (or the generic region fallback).
  const heroSource =
    mission.evidenceUrl && mission.evidenceType === MISSION_TYPE_PHOTO
      ? { uri: mission.evidenceUrl }
      : getRegionImage(placeFromTitle(mission.title));
  const typeKey = MISSION_TYPE_KEY[mission.type];
  const statusKey = MISSION_STATUS_KEY[mission.status];

  return (
    <ScreenContainer scroll noPadding backgroundColor={colors.surface}>
      <View style={styles.hero}>
        <Image source={heroSource} style={styles.heroImage} contentFit="cover" />
        <View style={[styles.heroOverlay, { top: insets.top + spacing(1.5) }]}>
          <IconButton icon="arrow-back" variant="solid" onPress={() => router.back()} />
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.badgeRow}>
          {typeKey ? <Badge label={t(typeKey)} tone="primary" /> : null}
          <Badge label={`${mission.rewardXP + mission.rewardCoins} ${t("mission.pts")}`} tone="gold" />
        </View>

        <Text style={styles.title}>{mission.title}</Text>
        {completed ? (
          <Text style={styles.completedDate}>
            {t("missionDetail.completedOn", { date: formatDate(mission.completedAt, locale) })}
          </Text>
        ) : null}

        <Card style={styles.instructionsCard}>
          <View style={styles.instructionsHeaderRow}>
            <Ionicons name="information-circle-outline" size={18} color={colors.navy} />
            <Text style={styles.instructionsTitle}>{t("missionDetail.instructionsTitle")}</Text>
          </View>
          {(["missionDetail.step1", "missionDetail.step2", "missionDetail.step3"] as const).map(
            (step, idx) => (
              <View key={step} style={styles.instructionRow}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>{idx + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{t(step)}</Text>
              </View>
            )
          )}
        </Card>

        <View style={styles.rewardRow}>
          <Card style={styles.rewardCard}>
            <Ionicons name="flag-outline" size={20} color={colors.navy} />
            <Text style={styles.rewardLabel}>{t("missionDetail.statusTitle")}</Text>
            <Text style={styles.rewardValue}>{statusKey ? t(statusKey) : "—"}</Text>
          </Card>
          <Card style={styles.rewardCard}>
            <Ionicons name="gift-outline" size={20} color={colors.gold} />
            <Text style={styles.rewardLabel}>{t("missionDetail.rewardTitle")}</Text>
            <Text style={styles.rewardValue}>
              +{mission.rewardXP} XP · +{mission.rewardCoins} Coin
            </Text>
          </Card>
        </View>

        {!completed ? (
          <Card style={styles.submitCard}>
            <Text style={styles.submitTitle}>{t("missionDetail.submitTitle")}</Text>

            {videoUri ? (
              <View style={styles.videoPreview}>
                <Ionicons name="videocam" size={28} color={colors.navy} />
                <Text style={styles.videoPreviewText}>
                  {t("missionDetail.videoRecorded", { seconds: videoDuration })}
                </Text>
              </View>
            ) : photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
            ) : (
              <View style={styles.evidencePlaceholder}>
                <Ionicons
                  name={mission.requiresVideo ? "videocam-outline" : "image-outline"}
                  size={26}
                  color={colors.textMuted}
                />
                <Text style={styles.evidencePlaceholderText}>{t("missionDetail.evidenceHint")}</Text>
              </View>
            )}

            <View style={styles.submitButtonRow}>
              {mission.requiresPhoto ? (
                <>
                  <Button title={t("missionDetail.takePhoto")} variant="secondary" icon="camera-outline" onPress={openCamera} style={{ flex: 1 }} />
                  <Button title={t("missionDetail.pickFromLibrary")} variant="secondary" icon="images-outline" onPress={pickFromLibrary} style={{ flex: 1 }} />
                </>
              ) : null}
              {mission.requiresVideo ? (
                <Button
                  title={videoUri ? t("missionDetail.reRecord") : t("missionDetail.recordVideo")}
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
                    ? t("missionDetail.locationValid", { distance: formatDistance(distance) })
                    : t("missionDetail.locationInvalid", { distance: formatDistance(distance) })
                  : coords
                    ? t("missionDetail.locationCoords", {
                        coords: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
                      })
                    : t("missionDetail.checkLocation")
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
              title={t("missionDetail.submit")}
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
  hero: { height: 220, backgroundColor: colors.surfaceAlt },
  heroImage: StyleSheet.absoluteFill,
  heroOverlay: { position: "absolute", left: spacing(2.5) },
  body: { padding: spacing(2.5), gap: spacing(1.5) },
  badgeRow: { flexDirection: "row", gap: spacing(1) },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  completedDate: { fontSize: 13, color: colors.success, fontWeight: "600" },
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
  rewardValue: { fontSize: 13, fontWeight: "700", color: colors.text, textAlign: "center" },
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
  evidencePlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(0.5),
    paddingHorizontal: spacing(2),
  },
  evidencePlaceholderText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  submitButtonRow: { flexDirection: "row", gap: spacing(1) },
});
