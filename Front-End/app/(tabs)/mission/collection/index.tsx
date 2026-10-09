import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { BackHeader } from "@/components/BackHeader";
import { EmptyState } from "@/components/EmptyState";
import { getItinerary } from "@/api/endpoints/itinerary";
import { listUserMissions } from "@/api/endpoints/missions";
import { getItineraryHistory } from "@/utils/itineraryHistory";
import { getCollectionCovers, setCollectionCover } from "@/utils/collectionCovers";
import { memoriesForTrip } from "@/utils/memories";
import { getRegionImage } from "@/data/regionImages";
import { useSmartBack } from "@/utils/backNavigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useLocale } from "@/i18n/LocaleContext";
import type { ItineraryResponse } from "@/types/itinerary";
import { MISSION_TYPE_PHOTO, type UserMission } from "@/types/missions";
import { colors, radius, spacing } from "@/theme/colors";

export default function MissionCollectionScreen() {
  const goBack = useSmartBack();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItineraryResponse[]>([]);
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [history, savedCovers, missionList] = await Promise.all([
      getItineraryHistory(user.id),
      getCollectionCovers(user.id),
      listUserMissions(user.id).catch(() => [] as UserMission[]),
    ]);
    const results = await Promise.all(
      history.map((h) => getItinerary(h.id).catch(() => null))
    );
    setItems(results.filter((r): r is ItineraryResponse => r !== null));
    setMissions(missionList);
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
      showToast(t("memories.library"), "error");
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
      <BackHeader title={t("memories.title")} onBack={goBack} />
      <Text style={styles.subtitle}>{t("memories.subtitle")}</Text>

      {loading ? (
        <ActivityIndicator color={colors.navy} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title={t("memories.emptyTitle")}
          description={t("memories.emptyDescription")}
        />
      ) : (
        <View style={styles.grid}>
          {items.map((item) => {
            const media = memoriesForTrip(missions, item.itinerary_id);
            // Cover priority: the user's own pick → their first mission
            // photo on this trip → a photo of the destination.
            const firstPhoto = media.find((m) => m.evidenceType === MISSION_TYPE_PHOTO)?.evidenceUrl;
            const custom = covers[item.itinerary_id] ?? firstPhoto;
            const cover = custom ? { uri: custom } : getRegionImage(item.trip_summary.cities[0]);
            return (
              <Pressable
                key={item.itinerary_id}
                style={styles.tile}
                onPress={() => router.push(`/(tabs)/mission/collection/${item.itinerary_id}`)}
              >
                <View style={styles.coverWrap}>
                  <Image source={cover} style={styles.cover} contentFit="cover" />
                  <Pressable
                    style={styles.editButton}
                    onPress={() => pickCover(item.itinerary_id)}
                    hitSlop={8}
                  >
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
                <Text style={styles.tileTitle} numberOfLines={1}>
                  {item.trip_summary.cities.join(" → ")}
                </Text>
                <Text style={styles.tileMeta}>{t("memories.count", { count: media.length })}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
