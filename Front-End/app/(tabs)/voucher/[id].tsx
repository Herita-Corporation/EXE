import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/ScreenContainer";
import { remoteImage } from "@/data/regionImages";
import { IconButton } from "@/components/IconButton";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { VoucherCategoryPill, VoucherIcon } from "@/components/VoucherIcon";
import * as vouchersApi from "@/api/endpoints/vouchers";
import { ApiError } from "@/api/http";
import type { Voucher } from "@/types/vouchers";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { formatDate } from "@/utils/date";
import { haptics } from "@/utils/haptics";
import { colors, radius, spacing } from "@/theme/colors";

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  // Redeemed code — the public voucher endpoint no longer returns it.
  const [ownedCode, setOwnedCode] = useState<string | null>(null);
  const owned = ownedCode !== null;
  const [availablePoints, setAvailablePoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [v, ownedList, balance] = await Promise.all([
        vouchersApi.getVoucher(id),
        user ? vouchersApi.getOwnedVouchers(user.id).catch(() => []) : Promise.resolve([]),
        user ? vouchersApi.getPointsBalance(user.id).catch(() => null) : Promise.resolve(null),
      ]);
      setVoucher(v);
      setOwnedCode(ownedList.find((o) => o.voucherId === id)?.code ?? null);
      setAvailablePoints(balance?.availablePoints ?? 0);
    } catch {
      setVoucher(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function onRedeem() {
    if (!user || !voucher) return;
    Alert.alert(
      t("voucher.redeem"),
      `${voucher.title} — ${voucher.pointsCost.toLocaleString()} ${t("voucher.pointsSuffix")}?`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("voucher.redeem"),
          onPress: async () => {
            setRedeeming(true);
            try {
              const res = await vouchersApi.redeemVoucher(voucher.id, user.id);
              const ownedList = await vouchersApi.getOwnedVouchers(user.id);
              setOwnedCode(ownedList.find((o) => o.voucherId === voucher.id)?.code ?? "");
              haptics.success();
              setAvailablePoints(res.remainingPoints);
              showToast(t("voucher.redeemSuccess"), "success");
            } catch (err) {
              showToast(err instanceof ApiError ? err.message : t("voucher.redeemFailed"), "error");
            } finally {
              setRedeeming(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ScreenContainer backgroundColor={colors.surface}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <ActivityIndicator color={colors.navy} />
      </ScreenContainer>
    );
  }

  if (!voucher) {
    return (
      <ScreenContainer backgroundColor={colors.surface}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <EmptyState icon="pricetags-outline" title={t("voucherDetail.notFound")} />
      </ScreenContainer>
    );
  }

  const missingPoints = Math.max(0, voucher.pointsCost - availablePoints);

  return (
    <ScreenContainer scroll noPadding backgroundColor={colors.surface}>
      <View style={styles.hero}>
        <Image source={remoteImage(voucher.imageUrl)} style={styles.heroImage} contentFit="cover" />
        <View style={[styles.heroTopRow, { top: insets.top + spacing(1.5) }]}>
          <IconButton icon="arrow-back" variant="solid" onPress={() => router.back()} />
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing(3) }]}>
        <VoucherIcon category={voucher.category} size={64} style={styles.floatingIcon} />
        <View style={styles.titleRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.badgeRow}>
              <VoucherCategoryPill category={voucher.category} onLight />
              {owned ? <Badge label={t("voucherDetail.owned")} tone="success" /> : null}
            </View>
            <Text style={styles.title}>{voucher.title}</Text>
          </View>
          <Text style={styles.discount}>{voucher.discountLabel}</Text>
        </View>
        <Text style={styles.description}>{voucher.description}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaIcon}><Ionicons name="location" size={14} color={colors.link} /></View>
          <Text style={styles.metaText}>{voucher.location}</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaIcon}><Ionicons name="calendar" size={14} color={colors.link} /></View>
          <Text style={styles.metaText}>
            {t("voucherDetail.expires", { date: formatDate(voucher.expiresAt, locale) })}
          </Text>
        </View>

        {owned ? (
          <Card variant="elevated" style={styles.qrCard}>
            <QRCode value={ownedCode || voucher.id} size={140} color={colors.navy} backgroundColor={colors.surface} />
            <Text style={styles.codeLabel}>
              {t("voucherDetail.code")} <Text style={styles.codeValue}>{ownedCode}</Text>
            </Text>
            <Text style={styles.codeHint}>{t("voucherDetail.presentQr")}</Text>
          </Card>
        ) : (
          <Card variant="elevated" style={styles.qrCard}>
            <View style={styles.lockIcon}>
              <Ionicons name="qr-code-outline" size={36} color={colors.textMuted} />
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={12} color={colors.primaryText} />
              </View>
            </View>
            <Text style={styles.lockedTitle}>{t("voucherDetail.lockedTitle")}</Text>
            <Text style={styles.codeHint}>{t("voucherDetail.lockedText")}</Text>
            <Button
              title={
                missingPoints > 0
                  ? t("voucherDetail.notEnoughPoints", { points: missingPoints.toLocaleString() })
                  : t("voucherDetail.redeemFor", { points: voucher.pointsCost.toLocaleString() })
              }
              icon={missingPoints > 0 ? "lock-closed-outline" : "gift-outline"}
              onPress={onRedeem}
              loading={redeeming}
              disabled={missingPoints > 0}
              style={styles.redeemButton}
            />
          </Card>
        )}

        <Text style={styles.sectionTitle}>{t("voucherDetail.info")}</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}><Ionicons name="information-circle" size={18} color={colors.link} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>{t("voucherDetail.about")}</Text>
              <Text style={styles.infoText}>{t("voucherDetail.aboutText")}</Text>
            </View>
          </View>
          {voucher.terms.length > 0 ? (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><Ionicons name="reader" size={18} color={colors.link} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.infoTitle}>{t("voucherDetail.terms")}</Text>
                  {voucher.terms.map((term) => (
                    <Text key={term} style={styles.infoText}>
                      • {term}
                    </Text>
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </Card>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { height: 200, backgroundColor: colors.surfaceAlt },
  heroImage: StyleSheet.absoluteFill,
  heroTopRow: {
    position: "absolute",
    left: spacing(2),
    right: spacing(2),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  body: { padding: spacing(2.5), gap: spacing(1.25) },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  // Pulled up so it overlaps the bottom edge of the hero photo.
  floatingIcon: { marginTop: -spacing(6), borderWidth: 3, borderColor: colors.surface },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing(0.75), flexWrap: "wrap" },
  metaIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.navy, marginTop: 4 },
  discount: { fontSize: 18, fontWeight: "800", color: colors.link },
  description: { color: colors.textMuted, fontSize: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  metaText: { color: colors.textMuted, fontSize: 12 },
  qrCard: { alignItems: "center", gap: spacing(1), paddingVertical: spacing(3) },
  codeLabel: { fontSize: 13, color: colors.textMuted },
  codeValue: { color: colors.navy, fontWeight: "700" },
  codeHint: { fontSize: 11, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing(2) },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  redeemButton: { alignSelf: "stretch", marginTop: spacing(1), marginHorizontal: spacing(2) },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(1) },
  infoCard: { gap: spacing(1) },
  infoRow: { flexDirection: "row", gap: spacing(1.25) },
  infoTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  infoText: { fontSize: 12, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border },
});
