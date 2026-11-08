import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SkeletonCard } from "@/components/Skeleton";
import { BackHeader } from "@/components/BackHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { getItinerary, listMyItineraries } from "@/api/endpoints/itinerary";
import { ApiError } from "@/api/http";
import { getItineraryHistory, type ItineraryHistoryEntry } from "@/utils/itineraryHistory";
import { useSmartBack } from "@/utils/backNavigation";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import type { ItineraryResponse } from "@/types/itinerary";
import { getRegionImage } from "@/data/regionImages";
import { formatDateRange, vietnamTodayIso } from "@/utils/date";
import { Image } from "expo-image";
import { colors, spacing } from "@/theme/colors";

function todayIso() {
  return vietnamTodayIso();
}

export default function MyItinerariesScreen() {
  const goBack = useSmartBack();
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [cloudError, setCloudError] = useState("");
  const [items, setItems] = useState<
    { entry: ItineraryHistoryEntry; data: ItineraryResponse }[]
  >([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setItems([]); setCloudError("");
    try {
      const trips = await listMyItineraries();
      setItems(trips.map(data => ({ data, entry: { id: data.itinerary_id, cities: data.trip_summary.cities, totalCost: data.total_cost, createdAt: data.created_at ?? "" } })));
      setLoading(false); return;
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) {
        setCloudError(e instanceof Error ? e.message : "Unable to load cloud history"); setLoading(false); return;
      }
      setCloudError(locale === "vi" ? "Máy chủ chưa hỗ trợ lịch sử cloud; đang xem dữ liệu thiết bị." : "Cloud history is not deployed; showing this device's history.");
    }
    const history = await getItineraryHistory(user.id);
    // Sorted newest-first by the local history's own createdAt.
    const results = await Promise.all(
      history.map(async (entry) => {
        try {
          const data = await getItinerary(entry.id);
          return { entry, data };
        } catch {
          return null;
        }
      })
    );
    setItems(
      results.filter(
        (r): r is { entry: ItineraryHistoryEntry; data: ItineraryResponse } =>
          r !== null
      )
    );
    setLoading(false);
  }, [user, locale]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = todayIso();
  const group = (data: ItineraryResponse) => data.display_group ?? (data.lifecycle?.status === "COMPLETED" || data.lifecycle?.status === "CANCELLED" || data.trip_summary.end_date < today ? "PAST" : data.trip_summary.start_date > today ? "UPCOMING" : "ONGOING");
  // Calendar dates determine Current/Future/Past. `startedAt` records a user
  // action only; it is not lifecycle truth for a scheduled itinerary.
  const currentItems = items.filter(
    ({ data }) =>
      group(data) === "ONGOING"
  );
  const future = items
    .filter(({ data }) => group(data) === "UPCOMING")
    .sort((a, b) =>
      a.data.trip_summary.start_date.localeCompare(b.data.trip_summary.start_date)
    );
  const past = items
    .filter(({ data }) => group(data) === "PAST")
    .sort((a, b) =>
      b.data.trip_summary.end_date.localeCompare(a.data.trip_summary.end_date)
    );
  const current = currentItems[0] ?? null;
  const additionalCurrent = currentItems.slice(1);

  const renderCompactCards = (
    list: { entry: ItineraryHistoryEntry; data: ItineraryResponse }[],
    label: string,
    tone: React.ComponentProps<typeof Badge>["tone"]
  ) =>
    list.map(({ data }) => (
      <Card
        key={data.itinerary_id}
        variant="media"
        style={styles.pastCard}
        imageSource={getRegionImage(data.trip_summary.cities[0])}
        overlay={<Badge label={label} tone={tone} />}
      >
        <Text style={styles.pastDates}>
          {formatDateRange(
            data.trip_summary.start_date,
            data.trip_summary.end_date,
            locale
          )}
        </Text>
        <Text style={styles.pastTitle}>
          {data.trip_summary.cities.join(" → ")}
        </Text>
        <Button
          title={t("itineraries.details")}
          variant="outline"
          onPress={() =>
            router.push(`/(tabs)/mission/itinerary/${data.itinerary_id}`)
          }
        />
      </Card>
    ));

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <BackHeader title={t("itineraries.title")} onBack={goBack} />
      {!!cloudError && <Text style={{ padding: 16, color: colors.textMuted }}>{cloudError}</Text>}
      <Text style={styles.subtitle}>
        {t("itineraries.subtitle")}
      </Text>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : items.length === 0 ? (
        <EmptyState
          title={t("itineraries.emptyTitle")}
          description={t("itineraries.emptyDescription")}
        />
      ) : (
        <>
          {current ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>{t("itineraries.currentJourney")}</Text>
                <Badge label={t("itineraries.active")} tone="success" />
              </View>
              <Card variant="elevated" style={styles.currentCard}>
                <Image
                  source={getRegionImage(current.data.trip_summary.cities[0])}
                  style={styles.currentImage}
                  contentFit="cover"
                />
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={12} color={colors.gold} />
                  <Text style={styles.currentLocation}>
                    {current.data.trip_summary.cities.join(", ")}
                  </Text>
                </View>
                <Text style={styles.currentTitle}>
                  {current.data.trip_summary.cities.join(" → ")}
                </Text>
                <Text style={styles.currentDates}>
                  {formatDateRange(current.data.trip_summary.start_date, current.data.trip_summary.end_date, locale)} ·{" "}
                  {current.data.trip_summary.trip_duration_days} {t("itineraries.days")}
                </Text>
                <Button
                  title={t("itineraries.viewDetails")}
                  onPress={() =>
                    router.push(`/(tabs)/mission/itinerary/${current.data.itinerary_id}`)
                  }
                />
              </Card>
              {renderCompactCards(
                additionalCurrent,
                t("itineraries.active"),
                "success"
              )}
            </>
          ) : null}

          {future.length > 0 ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>{t("itineraries.upcoming")}</Text>
              </View>
              {renderCompactCards(future, t("itineraries.upcoming"), "gold")}
            </>
          ) : null}

          {past.length > 0 ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>{t("itineraries.pastAdventures")}</Text>
              </View>
              {renderCompactCards(past, t("itineraries.completed"), "primary")}
            </>
          ) : null}
        </>
      )}

      <Pressable onPress={() => router.push("/(tabs)/mission/create")}>
        <View style={styles.newTripRow}>
          <Ionicons name="add-circle" size={20} color={colors.navy} />
          <Text style={styles.newTripText}>{t("itineraries.newTrip")}</Text>
        </View>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: colors.textMuted, fontSize: 13 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing(1),
  },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },
  currentCard: { gap: spacing(1) },
  currentImage: {
    height: 120,
    borderRadius: 12,
    backgroundColor: colors.navyCard,
    alignItems: "center",
    justifyContent: "center",
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  currentLocation: { color: colors.textMuted, fontSize: 12 },
  currentTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  currentDates: { color: colors.textMuted, fontSize: 12 },
  pastCard: { marginBottom: spacing(1) },
  pastDates: { color: colors.link, fontSize: 12, fontWeight: "700" },
  pastTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  newTripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(0.5),
    paddingVertical: spacing(1.5),
  },
  newTripText: { color: colors.navy, fontWeight: "700" },
});
