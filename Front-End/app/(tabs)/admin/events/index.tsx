import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as eventsApi from "@/api/endpoints/events";
import { ApiError } from "@/api/http";
import type { DisaEvent } from "@/types/events";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

export default function AdminEventsListScreen() {
  const { t } = useLocale();
  const [events, setEvents] = useState<DisaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await eventsApi.listAllEventsForAdmin());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("events.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("admin.manageEvents")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Button
        title={t("admin.createEvent")}
        icon="add"
        onPress={() => router.push("/(tabs)/admin/events/create")}
      />

      <ErrorBanner message={error} />

      {loading ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: spacing(2) }} />
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>{t("events.emptyTitle")}</Text>
      ) : (
        <View style={{ gap: spacing(1) }}>
          {events.map((ev) => (
            <Pressable key={ev.id} onPress={() => router.push(`/(tabs)/admin/events/${ev.id}`)}>
              <Card style={styles.eventCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <Text style={styles.eventMeta}>
                    {ev.city} · {new Date(ev.startDate).toLocaleDateString()}
                  </Text>
                </View>
                <Badge
                  label={ev.isActive ? t("admin.active") : t("admin.disabled")}
                  tone={ev.isActive ? "success" : "danger"}
                />
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing(2) },
  eventCard: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  eventTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  eventMeta: { fontSize: 12, color: colors.textMuted },
});
