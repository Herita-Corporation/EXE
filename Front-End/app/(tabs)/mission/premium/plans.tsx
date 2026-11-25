import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import {
  confirmPremiumOrder,
  createPremiumOrder,
  getPremiumPlans,
  getPremiumSubscription,
} from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PremiumBenefits } from "@/components/PremiumEntry";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useToast } from "@/context/ToastContext";
import bundledPlans from "@/data/premiumPlans.json";
import { useLocale, type Locale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";
import type { PremiumOrder, PremiumPlan, PremiumSubscription } from "@/types/premium";
import { useSmartBack } from "@/utils/backNavigation";
import { formatDate } from "@/utils/date";
import { isPremiumTest } from "@/utils/premiumTest";

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function planName(plan: PremiumPlan, locale: Locale) {
  if (locale === "vi") return plan.name;
  switch (plan.periodMonths) {
    case null: return "Basic";
    case 1: return "1 month";
    case 6: return "6 months";
    case 12: return "1 year";
    default: return plan.name;
  }
}

export default function PremiumPlansScreen() {
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const goBack = useSmartBack();
  const fromSpecial = from === "special";
  const [catalog, setCatalog] = useState<PremiumPlan[] | null>(null);
  const [subscription, setSubscription] = useState<PremiumSubscription | null>(null);
  const [subscriptionUnavailable, setSubscriptionUnavailable] = useState(false);
  const [order, setOrder] = useState<PremiumOrder | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const busy = useRef(false);
  const subscriptionRevision = useRef(0);
  const plans = catalog ?? bundledPlans;
  const checkoutDisabled = subscription?.demoCheckoutEnabled === false;
  const canCheckout = !loading && !!catalog && !!subscription && !subscriptionUnavailable && !checkoutDisabled;

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const revision = subscriptionRevision.current;
    setLoading(true);
    setCatalog(null);
    setError(null);
    setSubscriptionUnavailable(false);

    Promise.allSettled([getPremiumPlans(), getPremiumSubscription()]).then(([planResult, subscriptionResult]) => {
      if (cancelled) return;
      const livePlans = planResult.status === "fulfilled" ? planResult.value : null;
      if (Array.isArray(livePlans) &&
        bundledPlans.every((plan) => livePlans.some((livePlan) => livePlan?.id === plan.id))) {
        setCatalog(livePlans);
      }
      if (revision === subscriptionRevision.current) {
        if (subscriptionResult.status === "fulfilled" && typeof subscriptionResult.value?.active === "boolean") {
          setSubscription(subscriptionResult.value);
        } else {
          setSubscriptionUnavailable(true);
        }
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [loadVersion]));

  async function choose(plan: PremiumPlan) {
    if (busy.current || !canCheckout) return;
    busy.current = true;
    setPending(plan.id);
    setError(null);
    try {
      setOrder(await createPremiumOrder(plan.id));
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof ApiError && err.message.trim() ? err.message : t("premium.orderFailed"));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function confirm(demoOrder: PremiumOrder) {
    if (busy.current || confirmed) return;
    busy.current = true;
    setPending(demoOrder.id);
    setError(null);
    try {
      const updated = await confirmPremiumOrder(demoOrder.id);
      subscriptionRevision.current++;
      setSubscription(updated);
      setSubscriptionUnavailable(false);
      if (!updated.active) {
        setError(t("premium.confirmFailed"));
        return;
      }
      setConfirmed(true);
      if (fromSpecial) {
        showToast(t("premium.activated"), "success");
        openSpecialMissions();
      }
    } catch (err) {
      setError(err instanceof ApiError && err.message.trim() ? err.message : t("premium.confirmFailed"));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function closeOrder() {
    if (busy.current) return;
    setOrder(null);
    setError(null);
  }

  const activePlan = subscription?.active && !subscriptionUnavailable
    ? plans.find((plan) => plan.id === subscription.planId)
    : undefined;
  const orderPlan = plans.find((plan) => plan.id === order?.planId);
  const basicPlan = plans.find((plan) => plan.id === "basic");
  const paidPlans = plans.flatMap((plan) => plan.periodMonths
    ? [{ plan, months: plan.periodMonths, monthly: plan.priceVnd / plan.periodMonths }]
    : []);
  const monthlyPlan = paidPlans.find(({ months }) => months === 1)?.plan;
  const lowestMonthly = Math.min(...paidPlans.map(({ monthly }) => monthly));
  const activeLabel = activePlan
    ? t("premium.activeUntil", { plan: planName(activePlan, locale), date: formatDate(subscription?.expiresAt, locale) })
    : null;
  const availabilityMessage = !catalog ? t("premium.plansUnavailable")
    : subscriptionUnavailable ? t("premium.subscriptionUnavailable")
    : checkoutDisabled ? t("premium.checkoutUnavailable") : null;

  function openSpecialMissions() {
    router.replace("/(tabs)/mission/premium/special");
  }

  if (order) {
    return (
      <ScreenContainer>
        <BackHeader title={t("premium.demoPayment")} onBack={closeOrder} />
        <ErrorBanner message={error} />
        <Card style={styles.checkout}>
          <Badge label={t("premium.demoPayment")} tone="tint" />
          <Text style={styles.heading}>{orderPlan ? planName(orderPlan, locale) : order.planName}</Text>
          <Text style={styles.price}>{formatVnd(order.priceVnd)}</Text>
          {confirmed ? (
            <View style={styles.confirmed}>
              <Ionicons name="checkmark-circle" color={colors.success} size={40} />
              <Text style={styles.heading}>{t("premium.activated")}</Text>
              {activeLabel && <Text style={styles.centerText}>{activeLabel}</Text>}
            </View>
          ) : (
            <>
              <View style={styles.qr} accessible accessibilityLabel={t("premium.demoQr")}>
                <QRCode value={order.qrPayload} size={178} quietZone={12} color={colors.navyDeep} backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.centerText}>{t("premium.demoInstructions")}</Text>
            </>
          )}
        </Card>
        {confirmed ? (
          <Button
            title={t(fromSpecial ? "premium.goToSpecial" : "premium.goToMissions")}
            onPress={fromSpecial ? openSpecialMissions : () => router.navigate("/(tabs)/missions")}
            icon="flag-outline"
          />
        ) : (
          <Button title={t("premium.demoConfirm")} variant="amber" onPress={() => confirm(order)} loading={pending === order.id} />
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackHeader
        title={t("premium.title")}
        onBack={fromSpecial ? () => router.navigate("/(tabs)/missions") : goBack}
      />
      {(isPremiumTest || activeLabel) && (
        <View style={styles.planBadges}>
          {isPremiumTest && <Badge label={t("premium.testBuild")} tone="neutral" />}
          {activeLabel && <Badge label={activeLabel} tone="tint" />}
        </View>
      )}
      {activePlan?.specialMissions && fromSpecial && (
        <Button title={t("premium.goToSpecial")} onPress={openSpecialMissions} icon="flag-outline" size="sm" />
      )}
      <ErrorBanner message={error} />
      {loading && <ActivityIndicator color={colors.navy} />}
      {!loading && availabilityMessage && (
        <>
          <ErrorBanner message={availabilityMessage} />
          {(!catalog || subscriptionUnavailable) && (
            <Button title={t("premium.retry")} variant="outline" onPress={() => setLoadVersion((version) => version + 1)} disabled={pending !== null} />
          )}
        </>
      )}
      <View style={styles.paidPlans}>
        {paidPlans.map(({ plan, months, monthly }) => {
          const name = planName(plan, locale);
          const monthlyPrice = monthlyPlan ? monthlyPlan.priceVnd * months : 0;
          const discount = monthlyPrice ? Math.round((1 - plan.priceVnd / monthlyPrice) * 100) : 0;
          const bestValue = monthly === lowestMonthly && discount > 0;
          const periodColor = months === 6 ? styles.sixMonthCard : styles.monthlyCard;
          const cardColor = bestValue ? styles.valueCard : periodColor;
          return (
            <Card key={plan.id} style={{ ...styles.paidCard, ...cardColor }}>
              <View style={styles.planHeader}>
                <View style={styles.planDetails}>
                  <Text style={[styles.planName, bestValue && styles.onValueCard]}>{name}</Text>
                  {bestValue && <Badge label={t("premium.bestValue")} tone="gold" />}
                  {activePlan?.id === plan.id && <Badge label={t("premium.currentPlan")} tone="neutral" />}
                </View>
                <View style={styles.planPricing}>
                  <Text style={[styles.price, bestValue && styles.onValueCard]}>{formatVnd(plan.priceVnd)}</Text>
                  {months > 1 && (
                    <Text style={[styles.priceNote, bestValue && styles.valueNote]}>
                      {t(Number.isInteger(monthly) ? "premium.monthlyPrice" : "premium.approximateMonthlyPrice", {
                        price: formatVnd(Math.round(monthly)),
                      })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.planFooter}>
                {discount > 0 && (
                  <Text style={[styles.savings, bestValue && styles.valueSavings]}>
                    {t("premium.savePercent", { percent: discount })}
                  </Text>
                )}
                <Button
                  title={t("premium.choosePlan", { name })}
                  onPress={() => choose(plan)}
                  variant={bestValue ? "amber" : "primary"}
                  size="sm"
                  icon="arrow-forward"
                  iconPosition="right"
                  style={styles.planButton}
                  loading={pending === plan.id}
                  disabled={!canCheckout || pending !== null}
                />
              </View>
            </Card>
          );
        })}
      </View>
      {basicPlan && (
        <Card style={styles.basicCard}>
          <View style={styles.basicHeader}>
            <Text style={styles.planName}>{planName(basicPlan, locale)}</Text>
            <Text style={styles.body}>{t("premium.free")}</Text>
            {subscription && !subscriptionUnavailable && !subscription.active && (
              <Badge label={t("premium.currentPlan")} tone="neutral" />
            )}
          </View>
          <Text style={styles.body}>{t("premium.basicFeatures")}</Text>
        </Card>
      )}
      <Card style={styles.benefitsCard}>
        <Text style={styles.body}>{t("premium.sameBenefits")}</Text>
        <PremiumBenefits />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "800", color: colors.navy },
  body: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  centerText: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: "center" },
  paidPlans: { gap: spacing(1.25) },
  paidCard: { padding: spacing(1.75), gap: spacing(1) },
  monthlyCard: { backgroundColor: colors.blueSoft, borderColor: colors.sky },
  sixMonthCard: { backgroundColor: colors.successSoft, borderColor: colors.success },
  valueCard: { borderColor: colors.gold, backgroundColor: colors.navyCard },
  planHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing(1.25) },
  planDetails: { flex: 1, gap: spacing(0.5) },
  planBadges: { flexDirection: "row", flexWrap: "wrap", gap: spacing(0.75) },
  planName: { fontSize: 17, lineHeight: 23, fontWeight: "800", color: colors.navy },
  planPricing: { alignItems: "flex-end", flexShrink: 1 },
  price: { fontSize: 27, lineHeight: 33, fontWeight: "800", fontVariant: ["tabular-nums"], color: colors.navy },
  priceNote: { fontSize: 12, lineHeight: 17, color: colors.textMuted, textAlign: "right" },
  onValueCard: { color: colors.primaryText },
  valueNote: { color: "rgba(255,255,255,0.8)" },
  planFooter: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing(1) },
  savings: { flexGrow: 1, fontSize: 13, lineHeight: 18, fontWeight: "700", color: colors.navy },
  valueSavings: { color: colors.gold },
  planButton: { marginLeft: "auto", minHeight: 44 },
  basicCard: { backgroundColor: colors.surfaceAlt, padding: spacing(1.75) },
  basicHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing(1) },
  benefitsCard: { gap: spacing(1.5) },
  checkout: { alignItems: "center", gap: spacing(1.5), paddingVertical: spacing(3) },
  qr: { padding: spacing(1), borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF" },
  confirmed: { alignItems: "center", gap: spacing(1), marginTop: spacing(1) },
});
