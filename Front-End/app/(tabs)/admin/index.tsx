import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SettingsRow } from "@/components/SettingsRow";
import { useAuth } from "@/context/AuthContext";
import * as adminApi from "@/api/endpoints/admin";
import { ApiError } from "@/api/http";
import type { Customer } from "@/types/admin";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

export default function AdminIndexScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const isAdmin = !!user?.roles?.includes("Admin");
  const isManager = !!user?.roles?.includes("Manager");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    setError(null);
    try {
      setCustomers(await adminApi.listCustomers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [isManager, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("admin.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isAdmin ? (
        <>
          <Text style={styles.sectionLabel}>{t("admin.adminSection")}</Text>
          <Card style={styles.sectionCard}>
            <SettingsRow
              icon="person-add-outline"
              label={t("admin.createManager")}
              onPress={() => router.push("/(tabs)/admin/create-manager")}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="calendar-outline"
              label={t("admin.manageEvents")}
              onPress={() => router.push("/(tabs)/admin/events")}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="pricetag-outline"
              label={t("admin.manageVouchers")}
              onPress={() => router.push("/(tabs)/admin/vouchers")}
            />
          </Card>
        </>
      ) : null}

      {isManager ? (
        <>
          <Text style={styles.sectionLabel}>{t("admin.managerSection")}</Text>
          <ErrorBanner message={error} />
          {loading ? (
            <ActivityIndicator color={colors.navy} style={{ marginTop: spacing(2) }} />
          ) : customers.length === 0 ? (
            <Text style={styles.emptyText}>{t("admin.noCustomers")}</Text>
          ) : (
            <View style={{ gap: spacing(1) }}>
              {customers.map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/(tabs)/admin/${c.id}`)}>
                  <Card style={styles.customerCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerName}>{c.username}</Text>
                      <Text style={styles.customerEmail}>{c.email}</Text>
                    </View>
                    <Badge
                      label={c.isActive ? t("admin.active") : t("admin.disabled")}
                      tone={c.isActive ? "success" : "danger"}
                    />
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700", color: colors.navy },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing(1.5),
  },
  sectionCard: { gap: 0 },
  divider: { height: 1, backgroundColor: colors.border },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing(2) },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
  },
  customerName: { fontSize: 14, fontWeight: "700", color: colors.text },
  customerEmail: { fontSize: 12, color: colors.textMuted },
});
