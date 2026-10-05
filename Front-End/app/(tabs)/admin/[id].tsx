import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as adminApi from "@/api/endpoints/admin";
import { ApiError } from "@/api/http";
import type { Customer } from "@/types/admin";
import { useLocale } from "@/i18n/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { colors, spacing } from "@/theme/colors";

export default function AdminCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const c = await adminApi.getCustomer(id);
      setCustomer(c);
      setUsername(c.username);
      setEmail(c.email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onSave() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateCustomer(id, { username, email });
      await load();
      showToast(t("admin.updateSuccess"), "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.actionFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive() {
    if (!id || !customer) return;
    setToggling(true);
    setError(null);
    try {
      if (customer.isActive) {
        await adminApi.disableCustomer(id);
      } else {
        await adminApi.enableCustomer(id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.actionFailed"));
    } finally {
      setToggling(false);
    }
  }

  function onDelete() {
    if (!id) return;
    Alert.alert(t("admin.deleteConfirmTitle"), t("admin.deleteConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.delete"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          setError(null);
          try {
            await adminApi.deleteCustomer(id);
            router.back();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : t("admin.actionFailed"));
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("admin.customerDetail")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: spacing(3) }} />
      ) : customer ? (
        <>
          <ErrorBanner message={error} />

          <Card variant="elevated" style={styles.card}>
            <View style={styles.statusRow}>
              <Badge
                label={customer.isActive ? t("admin.active") : t("admin.disabled")}
                tone={customer.isActive ? "success" : "danger"}
              />
              <Text style={styles.joined}>
                {t("admin.joined")}: {new Date(customer.createdAt).toLocaleDateString()}
              </Text>
            </View>

            <Input
              label={t("admin.usernameLabel")}
              icon="person-outline"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <Input
              label={t("admin.emailLabel")}
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Button title={t("admin.saveChanges")} onPress={onSave} loading={saving} />
          </Card>

          <Card style={styles.card}>
            <Button
              title={customer.isActive ? t("admin.disable") : t("admin.enable")}
              variant={customer.isActive ? "outline" : "secondary"}
              onPress={onToggleActive}
              loading={toggling}
            />
            <Button title={t("admin.delete")} variant="danger" onPress={onDelete} loading={deleting} />
          </Card>
        </>
      ) : (
        <ErrorBanner message={error} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700", color: colors.navy },
  card: { marginTop: spacing(1.5), gap: spacing(1.5) },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  joined: { fontSize: 12, color: colors.textMuted },
});
