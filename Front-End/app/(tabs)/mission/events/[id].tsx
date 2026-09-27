import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as eventsApi from "@/api/endpoints/events";
import { ApiError } from "@/api/http";
import type { DisaEvent } from "@/types/events";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const [event, setEvent] = useState<DisaEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setLoading(true);
      setError(null);
      eventsApi
        .getEvent(id)
        .then(setEvent)
        .catch((err) => setError(err instanceof ApiError ? err.message : t("events.loadFailed")))
        .finally(() => setLoading(false));
    }, [id, t])
  );

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("events.eventDetail")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: spacing(3) }} />
      ) : event ? (
        <Card
          variant="media"
          imageSource={event.coverImageUrl ?? undefined}
          imageHeight={220}
          overlay={<Badge label={event.tag} tone="gold" />}
        >
          <Text style={styles.eventTitle}>{event.title}</Text>
          <View style={styles.metaRow}>
            <Badge label={event.city} tone="outline" />
            <Text style={styles.dateText}>
              {formatDate(event.startDate)} – {formatDate(event.endDate)}
            </Text>
          </View>
          <Text style={styles.description}>{event.description}</Text>
        </Card>
      ) : (
        <ErrorBanner message={error} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  eventTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  dateText: { fontSize: 12, color: colors.textMuted },
  description: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
