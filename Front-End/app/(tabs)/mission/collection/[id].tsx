import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getItinerary } from "@/api/endpoints/itinerary";
import { getMockCollectionMedia } from "@/mocks/collection";
import type { ItineraryResponse } from "@/types/itinerary";
import { useToast } from "@/context/ToastContext";
import { colors, radius, spacing } from "@/theme/colors";

export default function ItineraryCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getItinerary(id)
      .then(setItinerary)
      .catch(() => setError("Không tìm thấy lịch trình."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <ScreenContainer backgroundColor={colors.surface}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <ActivityIndicator color={colors.navy} />
      </ScreenContainer>
    );
  }

  if (error || !itinerary) {
    return (
      <ScreenContainer backgroundColor={colors.surface}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <ErrorBanner message={error ?? "Không tìm thấy lịch trình."} />
      </ScreenContainer>
    );
  }

  const media = getMockCollectionMedia(itinerary);

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title} numberOfLines={1}>
          {itinerary.trip_summary.cities.join(" & ")} Escape
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.subtitle}>
        {itinerary.trip_summary.start_date} - {itinerary.trip_summary.end_date} ·{" "}
        {media.length} memories
      </Text>

      <View style={styles.grid}>
        {media.map((item) => (
          <Pressable
            key={item.id}
            style={styles.tile}
            onPress={() =>
              showToast(`${item.caption}: Xem chi tiết minh chứng chưa có backend hỗ trợ.`, "info")
            }
          >
            <Image source={{ uri: item.uri }} style={styles.tileImage} contentFit="cover" />
            {item.type === "video" ? (
              <View style={styles.playBadge}>
                <Ionicons name="play" size={12} color="#FFFFFF" />
              </View>
            ) : null}
            <View style={styles.tileCaption}>
              <Text style={styles.tileTitle} numberOfLines={1}>
                {item.caption}
              </Text>
              <Text style={styles.tileLocation} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.navy, textAlign: "center" },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.5) },
  tile: { width: "47%", gap: spacing(0.5) },
  tileImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  playBadge: {
    position: "absolute",
    top: spacing(1),
    right: spacing(1),
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileCaption: { gap: 1 },
  tileTitle: { fontSize: 12, fontWeight: "700", color: colors.text },
  tileLocation: { fontSize: 11, color: colors.textMuted },
});
