import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

interface Props {
  logo: React.ReactNode;
  partnerName?: string;
  title: string;
  benefit?: string;
  meta: string;
  points?: number;
  redeemLabel?: string;
  redeemIcon?: keyof typeof Ionicons.glyphMap;
  onOpen: () => void;
  onRedeem: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function VoucherTicket({
  logo,
  partnerName,
  title,
  benefit,
  meta,
  points,
  redeemLabel,
  redeemIcon,
  onOpen,
  onRedeem,
  disabled,
  loading,
}: Props) {
  const { locale, t } = useLocale();
  const actionLabel = redeemLabel ?? t("voucher.redeemShort");

  return (
    <View style={styles.ticket}>
      <View style={styles.brand}>
        {logo}
      </View>
      <View pointerEvents="none" style={styles.perforation}>
        <View style={[styles.notch, styles.topNotch]} />
        <View style={[styles.notch, styles.bottomNotch]} />
      </View>
      <View style={styles.content}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={[partnerName, title, benefit, meta].filter(Boolean).join(". ")}
          onPress={onOpen}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {benefit ? <Text style={styles.benefit}>{benefit}</Text> : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </Pressable>
        <View style={styles.footer}>
          {points !== undefined && (
            <View style={styles.points}>
              <Ionicons name="star" size={13} color={colors.goldText} />
              <Text style={styles.pointsText}>
                {points.toLocaleString(locale)} {t("voucher.pointsSuffix")}
              </Text>
            </View>
          )}
          <Button
            title={actionLabel}
            accessibilityLabel={`${actionLabel} ${partnerName ?? title}`}
            icon={redeemIcon}
            iconPosition="right"
            size="sm"
            shape="rounded"
            variant="secondary"
            style={styles.button}
            onPress={onRedeem}
            disabled={disabled}
            loading={loading}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  brand: {
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(0.75),
    paddingVertical: spacing(1.25),
    backgroundColor: colors.surfaceAlt,
  },
  perforation: { width: 1, borderLeftWidth: 1, borderStyle: "dashed", borderColor: colors.border },
  notch: {
    position: "absolute",
    left: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  topNotch: { top: -8 },
  bottomNotch: { bottom: -8 },
  content: { flex: 1, minWidth: 0, justifyContent: "center", gap: spacing(0.75), padding: spacing(1.25) },
  pressed: { opacity: 0.65 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: "800", color: colors.text },
  benefit: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: colors.navy, marginTop: 2 },
  meta: { fontSize: 12, lineHeight: 16, color: colors.textMuted, marginTop: 2 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing(0.75),
  },
  points: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  pointsText: { fontSize: 13, fontWeight: "800", color: colors.navy, flexShrink: 1 },
  button: { minHeight: 40, minWidth: 64, borderRadius: radius.sm, marginLeft: "auto" },
});
