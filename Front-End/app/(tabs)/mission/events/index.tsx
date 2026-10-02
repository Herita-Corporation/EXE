import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
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
import { useSmartBack } from "@/utils/backNavigation";
import { enablePushNotifications } from "@/utils/pushNotifications";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

export default function EventsScreen() {
  const goBack = useSmartBack();
  const { t } = useLocale();
  const [enablingPush, setEnablingPush] = useState(false);
  const [events, setEvents] = useState<DisaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await eventsApi.listEvents());
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

  async function onEnableNotifications() {
    setEnablingPush(true);
    try {
      const enabled = await enablePushNotifications();
      Alert.alert(
        enabled ? t("events.notificationsEnabledTitle") : t("events.notificationsFailedTitle"),
        enabled ? t("events.notificationsEnabledMessage") : t("events.notificationsFailedMessage")
      );
    } finally {
      setEnablingPush(false);
    }
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={goBack} />
        <Text style={styles.title}>{t("events.title")}</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.eyebrow}>{t("events.discoverVietnam")}</Text>
      <Text style={styles.subtitle}>{t("events.subtitle")}</Text>

      <ErrorBanner message={error} />

      {loading ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: spacing(3) }} />
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>{t("events.emptyTitle")}</Text>
      ) : (
        events.map((event) => (
          <Card
            key={event.id}
            variant="media"
            imageSource={event.coverImageUrl ?? undefined}
            overlay={<Badge label={event.tag} tone="gold" />}
          >
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventCity}>{event.city}</Text>
            <Text style={styles.eventDescription} numberOfLines={2}>
              {event.description}
            </Text>
            <Button
              title={t("events.learnMore")}
              variant="secondary"
              icon="arrow-forward"
              iconPosition="right"
              onPress={() => router.push(`/(tabs)/mission/events/${event.id}`)}
            />
          </Card>
        ))
      )}

      <Card style={styles.notifyCard}>
        <View style={styles.notifyIcon}>
          <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.notifyTitle}>{t("events.neverMissABeat")}</Text>
        <Text style={styles.notifyText}>{t("events.enableNotificationsText")}</Text>
        <Button
          title={t("events.enableNotifications")}
          variant="secondary"
          loading={enablingPush}
          onPress={onEnableNotifications}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  eyebrow: { fontSize: 11, fontWeight: "700", color: colors.link, letterSpacing: 0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing(3) },
  eventTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  eventCity: { fontSize: 12, color: colors.navy, fontWeight: "600" },
  eventDescription: { fontSize: 12, color: colors.textMuted },
  notifyCard: { backgroundColor: colors.navyCard, borderWidth: 0, alignItems: "center", gap: spacing(1) },
  notifyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifyTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  notifyText: { color: "rgba(255,255,255,0.8)", fontSize: 12, textAlign: "center" },
});
