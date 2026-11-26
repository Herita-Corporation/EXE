import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";
import type { PremiumVoucher } from "@/types/premium";
import { formatDate } from "@/utils/date";

export function PremiumVoucherCard({
  voucher, shared = false, opening = false, onOpen,
}: {
  voucher: PremiumVoucher;
  shared?: boolean;
  opening?: boolean;
  onOpen: (voucher: PremiumVoucher) => void;
}) {
  const { t, locale } = useLocale();
  const issuedCode = voucher.kind === "issued_code";
  const start = formatDate(voucher.startsOn, locale);
  const end = formatDate(voucher.endsOn, locale);
  const validity = voucher.startsOn && voucher.endsOn
    ? t("premium.voucherPeriod", { start, end })
    : voucher.endsOn
      ? t("premium.voucherEnds", { date: end })
      : voucher.startsOn
        ? t("premium.voucherStarts", { date: start })
        : t("premium.providerPeriod");
  const expired = !!voucher.endsOn && Date.now() > Date.parse(`${voucher.endsOn}T23:59:59.999+07:00`);
  const upcoming = !!voucher.startsOn && Date.now() < Date.parse(`${voucher.startsOn}T00:00:00+07:00`);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="ticket-outline" size={22} color={colors.navy} />
        <Text style={styles.title}>
          {t(issuedCode ? "premium.personalVoucher" : shared ? "premium.sharedVoucher" : "premium.publicOffer")}
        </Text>
      </View>
      <Text style={styles.provider}>{voucher.provider}</Text>
      <Text style={styles.voucherTitle}>{voucher.title}</Text>
      <Text style={styles.body}>{voucher.benefit}</Text>
      <View style={styles.row}>
        <Badge label={t("premium.pointCost", { count: voucher.disaPointCost })} tone="gold" />
        {voucher.code && <Text selectable style={styles.code}>{t("premium.voucherCode", { code: voucher.code })}</Text>}
      </View>
      <Text style={styles.provider}>{validity}</Text>
      <Text style={styles.title}>{t("premium.terms")}</Text>
      <Text style={styles.body}>{voucher.terms}</Text>
      {voucher.scope ? <Text style={styles.body}>{voucher.scope}</Text> : null}
      {shared && <Text style={styles.body}>{voucher.groupUse || t("premium.groupVoucherUse")}</Text>}
      {expired ? <Text style={styles.body}>{t("partnerOffer.expired")}</Text> : upcoming ? (
        <Text style={styles.body}>{t("premium.upcomingVoucher")}</Text>
      ) : (
        <Button
          title={t(issuedCode ? "premium.useVoucher" : "partnerOffer.redeem")}
          onPress={() => onOpen(voucher)}
          loading={opening}
          icon="open-outline"
          iconPosition="right"
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(1.25) },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing(0.75) },
  title: { fontSize: 15, fontWeight: "700", color: colors.navy },
  body: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  provider: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: colors.navy },
  voucherTitle: { fontSize: 18, lineHeight: 23, fontWeight: "800", color: colors.text },
  code: { flexShrink: 1, fontSize: 15, fontWeight: "800", color: colors.navy },
});
