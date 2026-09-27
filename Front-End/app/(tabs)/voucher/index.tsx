import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as vouchersApi from "@/api/endpoints/vouchers";
import { ApiError } from "@/api/http";
import type { PointsBalance, Voucher } from "@/types/vouchers";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import type { TranslationKey } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

// Filter values match voucher.category from real DATA (kept in English,
// same as other catalog content) — only the displayed Chip label is
// translated, via this lookup, so the comparison against v.category still
// works regardless of the selected app language.
const FILTER_KEYS: Record<string, TranslationKey> = {
  "All Offers": "voucher.filterAll",
  Hotels: "voucher.filterHotels",
  Dining: "voucher.filterDining",
  Experience: "voucher.filterExperience",
  Wellness: "voucher.filterWellness",
  Travel: "voucher.filterTravel",
  Transport: "voucher.filterTransport",
};
const FILTERS = Object.keys(FILTER_KEYS);

export default function VoucherScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [filter, setFilter] = useState("All Offers");
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const load = useCallback(() => {
    vouchersApi.listVouchers().then(setVouchers).catch(() => {});
    if (user) vouchersApi.getPointsBalance(user.id).then(setBalance).catch(() => {});
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered =
    filter === "All Offers" ? vouchers : vouchers.filter((v) => v.category === filter);

  function onRedeem(v: Voucher) {
    if (!user) return;
    Alert.alert(
      t("voucher.redeem"),
      `${v.title} — ${v.pointsCost.toLocaleString()} ${t("voucher.pointsSuffix")}?`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("voucher.redeem"),
          onPress: async () => {
            setError(null);
            setRedeemingId(v.id);
            try {
              await vouchersApi.redeemVoucher(v.id, user.id);
              load();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : t("voucher.redeemFailed"));
            } finally {
              setRedeemingId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <ScreenContainer avoidTabBar backgroundColor={colors.surface}>
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t("voucher.totalVoyagerBalance")}</Text>
        <Text style={styles.balanceValue}>
          {(balance?.availablePoints ?? 0).toLocaleString()} <Text style={styles.balanceUnit}>{t("voucher.points")}</Text>
        </Text>
        <View style={styles.balanceButtonsRow}>
          <Button
            title={t("voucher.history")}
            variant="secondary"
            size="sm"
            onPress={() => router.push("/(tabs)/voucher/collection")}
          />
          <Button
            title={t("voucher.earnMore")}
            variant="ghost"
            size="sm"
            onPress={() => router.push("/(tabs)/mission")}
          />
        </View>
      </Card>

      <ErrorBanner message={error} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(FILTER_KEYS[f])}
            selected={filter === f}
            onPress={() => setFilter(f)}
            style={{ marginRight: spacing(1) }}
          />
        ))}
      </ScrollView>

      {filtered.map((v) => (
        <Pressable key={v.id} onPress={() => router.push(`/(tabs)/voucher/${v.id}`)}>
          <Card
            variant="media"
            imageSource={v.imageUrl}
            overlay={<Badge label={v.category} tone="gold" />}
          >
            <Text style={styles.voucherTitle}>{v.title}</Text>
            <Text style={styles.voucherDescription}>{v.description}</Text>
            <View style={styles.voucherFooterRow}>
              <View style={styles.pointsRow}>
                <Ionicons name="add-circle" size={14} color={colors.gold} />
                <Text style={styles.pointsText}>{v.pointsCost.toLocaleString()} {t("voucher.pointsSuffix")}</Text>
              </View>
              <Button
                title={t("voucher.redeem")}
                size="sm"
                loading={redeemingId === v.id}
                onPress={() => onRedeem(v)}
              />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  balanceCard: { backgroundColor: colors.navy, borderWidth: 0, gap: spacing(1) },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  balanceValue: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  balanceUnit: { fontSize: 13, fontWeight: "700", color: colors.gold },
  balanceButtonsRow: { flexDirection: "row", gap: spacing(1) },
  // flexGrow: 0 stops the ScrollView itself from stretching to fill leftover
  // vertical space in the page (its default cross-axis alignItems: "stretch"
  // was also pulling each pill-shaped Chip to that same inflated height —
  // fixed separately below via filterContent — but that only fixed the
  // children; the row's own box was still oversized, leaving blank space
  // around the now-normal-sized chips).
  filterRow: { marginHorizontal: -spacing(2.5), paddingLeft: spacing(2.5), flexGrow: 0 },
  filterContent: { alignItems: "center" },
  voucherTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  voucherDescription: { fontSize: 12, color: colors.textMuted },
  voucherFooterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pointsText: { fontSize: 12, fontWeight: "700", color: colors.text },
});
