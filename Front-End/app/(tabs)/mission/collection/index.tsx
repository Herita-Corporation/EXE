import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { EmptyState } from "@/components/EmptyState";
import { getItinerary } from "@/api/endpoints/itinerary";
import { getItineraryHistory } from "@/utils/itineraryHistory";
import { getCollectionCovers, setCollectionCover } from "@/utils/collectionCovers";
import { getDefaultCover, getMockCollectionMedia } from "@/mocks/collection";
import { useSmartBack } from "@/utils/backNavigation";
import { useAuth } from "@/context/AuthContext";
import type { ItineraryResponse } from "@/types/itinerary";
import { colors, radius, spacing } from "@/theme/colors";

export default function MissionCollectionScreen() {
  const goBack = useSmartBack();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItineraryResponse[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [history, savedCovers] = await Promise.all([
      getItineraryHistory(user.id),
      getCollectionCovers(user.id),
    ]);
    const results = await Promise.all(
      history.map((h) => getItinerary(h.id).catch(() => null))
    );
    setItems(results.filter((r): r is ItineraryResponse => r !== null));
    setCovers(savedCovers);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function pickCover(itineraryId: string) {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Thiếu quyền", "Cần quyền truy cập thư viện ảnh.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      await setCollectionCover(user.id, itineraryId, uri);
      setCovers((prev) => ({ ...prev, [itineraryId]: uri }));
    }
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={goBack} />
        <Text style={styles.title}>My Collection</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.subtitle}>
        Photos and videos captured while completing missions on each trip.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.navy} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có lịch trình nào"
          description="Tạo lịch trình để bắt đầu lưu giữ kỷ niệm chuyến đi."
        />
      ) : (
        <View style={styles.grid}>
          {items.map((item) => {
            const mediaCount = getMockCollectionMedia(item).length;
            const cover = covers[item.itinerary_id] ?? getDefaultCover(item.itinerary_id);
            return (
              <Pressable
                key={item.itinerary_id}
                style={styles.tile}
                onPress={() => router.push(`/(tabs)/mission/collection/${item.itinerary_id}`)}
              >
                <View style={styles.coverWrap}>
                  <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
                  <Pressable
                    style={styles.editButton}
                    onPress={() => pickCover(item.itinerary_id)}
                    hitSlop={8}
                  >
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
                <Text style={styles.tileTitle} numberOfLines={1}>
                  {item.trip_summary.cities.join(" & ")} Escape
                </Text>
                <Text style={styles.tileMeta}>{mediaCount} memories</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.5) },
  tile: { width: "47%", gap: spacing(0.5) },
  coverWrap: { position: "relative" },
  cover: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  editButton: {
    position: "absolute",
    bottom: spacing(0.75),
    right: spacing(0.75),
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  tileMeta: { fontSize: 11, color: colors.textMuted },
});
