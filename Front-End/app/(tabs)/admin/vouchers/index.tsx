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
import * as vouchersApi from "@/api/endpoints/vouchers";
import { ApiError } from "@/api/http";
import type { Voucher } from "@/types/vouchers";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

export default function AdminVouchersListScreen() {
  const { t } = useLocale();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVouchers(await vouchersApi.listAllVouchersForAdmin());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("voucher.loadFailed"));
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
        <Text style={styles.title}>{t("admin.manageVouchers")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Button
        title={t("admin.createVoucher")}
        icon="add"
        onPress={() => router.push("/(tabs)/admin/vouchers/create")}
      />

      <ErrorBanner message={error} />

      {loading ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: spacing(2) }} />
      ) : vouchers.length === 0 ? (
        <Text style={styles.emptyText}>{t("voucher.noVouchers")}</Text>
      ) : (
        <View style={{ gap: spacing(1) }}>
          {vouchers.map((v) => (
            <Pressable key={v.id} onPress={() => router.push(`/(tabs)/admin/vouchers/${v.id}`)}>
              <Card style={styles.voucherCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.voucherTitle}>{v.title}</Text>
                  <Text style={styles.voucherMeta}>
                    {v.category} · {v.pointsCost.toLocaleString()} pts
                  </Text>
                </View>
                <Badge
                  label={v.isActive ? t("admin.active") : t("admin.disabled")}
                  tone={v.isActive ? "success" : "danger"}
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
  voucherCard: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  voucherTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  voucherMeta: { fontSize: 12, color: colors.textMuted },
});
