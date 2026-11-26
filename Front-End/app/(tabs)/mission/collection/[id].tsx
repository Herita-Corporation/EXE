import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/ScreenContainer";
import { BackHeader } from "@/components/BackHeader";
import { ErrorBanner } from "@/components/ErrorBanner";
import { EmptyState } from "@/components/EmptyState";
import { getItinerary } from "@/api/endpoints/itinerary";
import { listUserMissions } from "@/api/endpoints/missions";
import { memoriesForTrip } from "@/utils/memories";
import { formatDate, formatDateRange } from "@/utils/date";
import type { ItineraryResponse } from "@/types/itinerary";
import { MISSION_TYPE_VIDEO, type UserMission } from "@/types/missions";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

export default function ItineraryCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [media, setMedia] = useState<UserMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UserMission | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getItinerary(id),
      user ? listUserMissions(user.id).catch(() => [] as UserMission[]) : Promise.resolve([]),
    ])
      .then(([trip, missions]) => {
        setItinerary(trip);
        setMedia(memoriesForTrip(missions, id));
      })
      .catch(() => setError(t("itineraryDetail.notFound")))
      .finally(() => setLoading(false));
  }, [id, user, t]);

  function openItem(item: UserMission) {
    if (!item.evidenceUrl) return;
    if (item.evidenceType === MISSION_TYPE_VIDEO) {
      Linking.openURL(item.evidenceUrl);
    } else {
      setPreview(item);
    }
  }

  if (loading || error || !itinerary) {
    return (
      <ScreenContainer backgroundColor={colors.surface}>
        <BackHeader title={t("memories.title")} onBack={() => router.back()} />
        {loading ? (
          <ActivityIndicator color={colors.navy} />
        ) : (
          <ErrorBanner message={error ?? t("itineraryDetail.notFound")} />
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <BackHeader title={itinerary.trip_summary.cities.join(" → ")} onBack={() => router.back()} />
      <Text style={styles.subtitle}>
        {formatDateRange(itinerary.trip_summary.start_date, itinerary.trip_summary.end_date, locale)} ·{" "}
        {t("memories.count", { count: media.length })}
      </Text>

      {media.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title={t("memories.emptyTitle")}
          description={t("memories.emptyDescription")}
        />
      ) : (
        <View style={styles.grid}>
          {media.map((item) => {
            const isVideo = item.evidenceType === MISSION_TYPE_VIDEO;
            return (
              <Pressable key={item.id} style={styles.tile} onPress={() => openItem(item)}>
                {isVideo ? (
                  <View style={[styles.tileImage, styles.videoTile]}>
                    <Ionicons name="play-circle" size={40} color="#FFFFFF" />
                  </View>
                ) : (
                  <Image source={{ uri: item.evidenceUrl! }} style={styles.tileImage} contentFit="cover" />
                )}
                <View style={styles.tileCaption}>
                  <Text style={styles.tileTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.tileLocation} numberOfLines={1}>
                    {formatDate(item.completedAt, locale)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
          {preview?.evidenceUrl ? (
            <Image source={{ uri: preview.evidenceUrl }} style={styles.previewImage} contentFit="contain" />
          ) : null}
          <Text style={[styles.previewCaption, { bottom: insets.bottom + spacing(4) }]} numberOfLines={2}>
            {preview?.title}
          </Text>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: colors.textMuted, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.5) },
  tile: { width: "47%", gap: spacing(0.5) },
  tileImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  videoTile: { backgroundColor: colors.navyCard, alignItems: "center", justifyContent: "center" },
  tileCaption: { gap: 1 },
  tileTitle: { fontSize: 12, fontWeight: "700", color: colors.text },
  tileLocation: { fontSize: 11, color: colors.textMuted },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: { width: "100%", height: "75%" },
  previewCaption: {
    position: "absolute",
    left: spacing(3),
    right: spacing(3),
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
