import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import * as vouchersApi from "@/api/endpoints/vouchers";
import type { OwnedVoucher, PointsBalance } from "@/types/vouchers";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

function isExpiringSoon(expiresAt: string) {
  const days = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 3;
}

export default function VoucherCollectionScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [owned, setOwned] = useState<OwnedVoucher[]>([]);
  const [balance, setBalance] = useState<PointsBalance | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      vouchersApi.getOwnedVouchers(user.id).then(setOwned).catch(() => {});
      vouchersApi.getPointsBalance(user.id).then(setBalance).catch(() => {});
    }, [user])
  );

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("voucher.myCollection")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Card style={styles.totalCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalLabel}>{t("voucher.totalRewards")}</Text>
          <Text style={styles.totalValue}>
            {owned.length} {t("voucher.activeVouchers")}
          </Text>
          <View style={styles.pointsRow}>
            <Ionicons name="star" size={12} color={colors.gold} />
            <Text style={styles.pointsText}>
              {(balance?.availablePoints ?? 0).toLocaleString()} {t("voucher.travelPoints")}
            </Text>
          </View>
        </View>
        <View style={styles.ticketIcon}>
          <Ionicons name="ticket" size={22} color="#FFFFFF" />
        </View>
      </Card>

      <Pressable onPress={() => router.push("/(tabs)/voucher")}>
        <Card style={styles.redeemRow}>
          <View style={styles.redeemIcon}>
            <Ionicons name="storefront-outline" size={18} color={colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.redeemTitle}>{t("voucher.redeem")}</Text>
            <Text style={styles.redeemSubtitle}>{t("voucher.exploreExperiences")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      </Pressable>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("voucher.myCollection")}</Text>
      </View>

      {owned.length === 0 ? (
        <Text style={styles.emptyText}>{t("voucher.noOwnedVouchers")}</Text>
      ) : (
        owned.map((v) => (
          <Pressable key={v.redemptionId} onPress={() => router.push(`/(tabs)/voucher/${v.voucherId}`)}>
            <Card style={styles.itemCard}>
              <Image source={{ uri: v.imageUrl }} style={styles.itemImage} contentFit="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.itemHeaderRow}>
                  <Badge label={v.category} tone="neutral" />
                  <Text style={[styles.expiresText, isExpiringSoon(v.expiresAt) && styles.expiresUrgent]}>
                    {t("voucher.exp")} {new Date(v.expiresAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.itemTitle}>{v.title}</Text>
                <Text style={styles.itemSubtitle}>{v.code}</Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  totalCard: { backgroundColor: colors.navy, borderWidth: 0, flexDirection: "row", alignItems: "center" },
  totalLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  totalValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginTop: 2 },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  pointsText: { color: colors.gold, fontSize: 12, fontWeight: "700" },
  ticketIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  redeemRow: { flexDirection: "row", alignItems: "center", gap: spacing(1.25) },
  redeemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  redeemSubtitle: { fontSize: 12, color: colors.textMuted },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing(1),
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing(2) },
  itemCard: { flexDirection: "row", gap: spacing(1.25) },
  itemImage: { width: 64, height: 64, borderRadius: radius.md },
  itemHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  expiresText: { fontSize: 11, color: colors.textMuted },
  expiresUrgent: { color: colors.danger, fontWeight: "700" },
  itemTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  itemSubtitle: { fontSize: 12, color: colors.textMuted },
});
