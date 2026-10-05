import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { VoucherCategoryPill, VoucherIcon } from "@/components/VoucherIcon";
import * as vouchersApi from "@/api/endpoints/vouchers";
import type { Voucher } from "@/types/vouchers";
import { useLocale } from "@/i18n/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { colors, radius, spacing } from "@/theme/colors";

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    vouchersApi
      .getVoucher(id)
      .then(setVoucher)
      .catch(() => setVoucher(null))
      .finally(() => setLoading(false));
  }, [id]);

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
        <Text style={{ color: colors.textMuted }}>Không tìm thấy voucher.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll noPadding backgroundColor={colors.surface}>
      <View style={styles.hero}>
        <Image source={{ uri: voucher.imageUrl }} style={styles.heroImage} contentFit="cover" />
        <View style={[styles.heroTopRow, { top: insets.top + spacing(1.5) }]}>
          <IconButton icon="arrow-back" variant="glass" onPress={() => router.back()} />
          <IconButton
            icon="share-outline"
            variant="glass"
            onPress={() => showToast("Chưa hỗ trợ chia sẻ.", "info")}
          />
        </View>
      </View>

      <View style={styles.body}>
        <VoucherIcon category={voucher.category} size={64} style={styles.floatingIcon} />
        <View style={styles.titleRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.badgeRow}>
              <VoucherCategoryPill category={voucher.category} onLight />
              <Badge label="PREMIUM REWARDS" tone="gold" />
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
          <Text style={styles.metaText}>Expires {new Date(voucher.expiresAt).toLocaleDateString()}</Text>
        </View>

        <Card variant="elevated" style={styles.qrCard}>
          <QRCode value={voucher.code} size={140} color={colors.navy} backgroundColor={colors.surface} />
          <Text style={styles.codeLabel}>
            Voucher Code: <Text style={styles.codeValue}>{voucher.code}</Text>
          </Text>
          <Text style={styles.codeHint}>Present this QR to the front desk</Text>
        </Card>

        <Text style={styles.sectionTitle}>Information</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}><Ionicons name="information-circle" size={18} color={colors.link} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>About this voucher</Text>
              <Text style={styles.infoText}>
                This exclusive member discount applies to bookings at participating partners.
              </Text>
            </View>
          </View>
          {voucher.terms.length > 0 ? (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><Ionicons name="reader" size={18} color={colors.link} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.infoTitle}>Terms of Use</Text>
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

        <Button
          title="Add to Apple Wallet"
          variant="outline"
          disabled
          icon="wallet-outline"
          onPress={() => {}}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { height: 200 },
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
  codeHint: { fontSize: 11, color: colors.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(1) },
  infoCard: { gap: spacing(1) },
  infoRow: { flexDirection: "row", gap: spacing(1.25) },
  infoTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  infoText: { fontSize: 12, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border },
});
