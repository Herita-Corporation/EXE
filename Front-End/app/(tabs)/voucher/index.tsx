import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { GradientHero } from "@/components/GradientHero";
import { VoucherCategoryPill, VoucherIcon } from "@/components/VoucherIcon";
import { ALL_CATEGORY_ICON, categoryStyle } from "@/utils/voucherCategory";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as vouchersApi from "@/api/endpoints/vouchers";
import { ApiError } from "@/api/http";
import type { PointsBalance, Voucher } from "@/types/vouchers";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useLocale } from "@/i18n/LocaleContext";
import type { TranslationKey } from "@/i18n/LocaleContext";
import { brand, colors, radius, spacing } from "@/theme/colors";

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
  const { showToast } = useToast();
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
              showToast(t("voucher.redeemSuccess"), "success");
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
    <ScreenContainer avoidTabBar>
      <ScreenHeader title={t("tabs.voucher")} subtitle={t("voucher.exploreExperiences")} />

      <GradientHero style={styles.balanceCard} markStyle={{ opacity: 0.1 }}>
        <Text style={styles.balanceLabel}>{t("voucher.totalVoyagerBalance")}</Text>
        <Text style={styles.balanceValue}>
          {(balance?.availablePoints ?? 0).toLocaleString()} <Text style={styles.balanceUnit}>{t("voucher.points")}</Text>
        </Text>
        <View style={styles.balanceButtonsRow}>
          <Pressable style={styles.balanceBtn} onPress={() => router.push("/(tabs)/voucher/collection")}>
            <Ionicons name="wallet-outline" size={16} color={brand.navy} />
            <Text style={styles.balanceBtnText}>{t("voucher.history")}</Text>
          </Pressable>
          <Pressable
            style={[styles.balanceBtn, styles.balanceBtnGold]}
            onPress={() => router.push("/(tabs)/mission")}
          >
            <Ionicons name="flash" size={16} color={colors.onAmber} />
            <Text style={styles.balanceBtnText}>{t("voucher.earnMore")}</Text>
          </Pressable>
        </View>
      </GradientHero>

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
            icon={f === "All Offers" ? ALL_CATEGORY_ICON : categoryStyle(f).icon}
            iconColor={f === "All Offers" ? colors.navy : categoryStyle(f).color}
            onPress={() => setFilter(f)}
            style={{ marginRight: spacing(1) }}
          />
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState icon="pricetags-outline" title={t("voucher.noVouchers")} />
      ) : null}

      {filtered.map((v) => (
        <Pressable key={v.id} onPress={() => router.push(`/(tabs)/voucher/${v.id}`)}>
          <Card
            variant="media"
            imageSource={v.imageUrl}
            imageHeight={150}
            overlay={<VoucherCategoryPill category={v.category} />}
          >
            <View style={styles.voucherHead}>
              <VoucherIcon category={v.category} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.voucherTitle} numberOfLines={1}>{v.title}</Text>
                <Text style={styles.voucherDescription} numberOfLines={2}>{v.description}</Text>
              </View>
            </View>
            <View style={styles.voucherDivider} />
            <View style={styles.voucherFooterRow}>
              <View style={styles.pointsRow}>
                <View style={styles.pointsIcon}>
                  <Ionicons name="star" size={12} color={colors.gold} />
                </View>
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
  balanceCard: { gap: spacing(1) },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  balanceValue: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  balanceUnit: { fontSize: 13, fontWeight: "700", color: colors.gold },
  balanceButtonsRow: { flexDirection: "row", gap: spacing(1), marginTop: spacing(1) },
  balanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.75),
  },
  balanceBtnGold: { backgroundColor: colors.gold },
  balanceBtnText: { color: brand.navy, fontSize: 13, fontWeight: "800" },
  // flexGrow: 0 stops the ScrollView itself from stretching to fill leftover
  // vertical space in the page (its default cross-axis alignItems: "stretch"
  // was also pulling each pill-shaped Chip to that same inflated height —
  // fixed separately below via filterContent — but that only fixed the
  // children; the row's own box was still oversized, leaving blank space
  // around the now-normal-sized chips).
  filterRow: { marginHorizontal: -spacing(2.5), paddingLeft: spacing(2.5), flexGrow: 0 },
  filterContent: { alignItems: "center" },
  voucherHead: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  voucherTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  voucherDescription: { fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  voucherDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(0.5) },
  pointsIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.goldMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  voucherFooterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pointsText: { fontSize: 13, fontWeight: "800", color: colors.navy },
});
