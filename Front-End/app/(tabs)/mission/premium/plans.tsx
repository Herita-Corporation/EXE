import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  createPremiumQrPayment,
  getPremiumEntitlement,
  getPremiumPayment,
  getPremiumPlans,
} from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PremiumBenefits } from "@/components/PremiumEntry";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, spacing } from "@/theme/colors";
import type { PremiumEntitlement, PremiumPlan, PremiumQrPayment } from "@/types/premium";

const checkoutEnabled = process.env.EXPO_PUBLIC_ENABLE_PREMIUM_CHECKOUT === "true";

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function planDuration(plan: PremiumPlan) {
  return plan.durationMonths === 12 ? "1 năm" : `${plan.durationMonths} tháng`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function PremiumPlansScreen() {
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [entitlement, setEntitlement] = useState<PremiumEntitlement | null>(null);
  const [payment, setPayment] = useState<PremiumQrPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextPlans, nextEntitlement] = await Promise.all([
        checkoutEnabled ? getPremiumPlans() : Promise.resolve([]),
        getPremiumEntitlement(),
      ]);
      setPlans(nextPlans);
      setEntitlement(nextEntitlement);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải thông tin DISA Premium.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!payment || ["PAID", "FAILED", "EXPIRED"].includes(payment.status)) return;
    const timer = setInterval(() => {
      void getPremiumPayment(payment.paymentId).then(async (status) => {
        setPayment((current) => current ? { ...current, status: status.status } : current);
        if (status.status === "PAID") {
          try {
            setEntitlement(await getPremiumEntitlement());
          } catch {
            // The status card still accurately confirms the payment result.
          }
        }
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [payment]);

  async function startPayment(plan: PremiumPlan) {
    if (!checkoutEnabled) return;
    setPendingCode(plan.code);
    setError(null);
    try {
      setPayment(await createPremiumQrPayment(plan.code));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo mã thanh toán.");
    } finally {
      setPendingCode(null);
    }
  }

  if (payment) {
    const paid = payment.status === "PAID";
    return (
      <ScreenContainer>
        <BackHeader title="Thanh toán DISA Premium" onBack={() => setPayment(null)} />
        <Card style={styles.paymentCard}>
          <Text style={styles.planName}>{payment.planName}</Text>
          <Text style={styles.price}>{formatVnd(payment.amount)}</Text>
          {paid ? (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={styles.successTitle}>Premium đã được kích hoạt</Text>
              <Text style={styles.center}>Quyền lợi sẽ được đồng bộ cho tài khoản của bạn.</Text>
            </View>
          ) : (
            <>
              <Image source={{ uri: payment.qrUrl }} style={styles.qr} contentFit="contain" />
              <Text style={styles.center}>Quét mã QR và chuyển đúng số tiền với nội dung bên dưới.</Text>
              <Text style={styles.renewalHint}>
                Sau khi thanh toán thành công, Premium sẽ có hiệu lực đến {formatDate(payment.projectedExpiresAtUtc)}.
              </Text>
              <Text selectable style={styles.transfer}>{payment.transferContent}</Text>
              <Text style={styles.status}>Trạng thái: {payment.status}</Text>
            </>
          )}
        </Card>
        <Button
          title={paid ? "Xem nhiệm vụ Premium" : "Đóng"}
          onPress={() => paid ? router.replace("/(tabs)/mission") : setPayment(null)}
          variant={paid ? "primary" : "outline"}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackHeader title="DISA Premium" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      {loading ? <ActivityIndicator color={colors.navy} /> : (
        <>
          {entitlement?.isPremium && (
            <Card style={styles.activeCard}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>{entitlement.subscriptionStatus === "TRIAL" ? "Bạn đang dùng thử DISA Premium" : "Bạn đang dùng DISA Premium"}</Text>
                {entitlement.expiresAtUtc && <Text style={styles.body}>Hiệu lực đến {new Date(entitlement.expiresAtUtc).toLocaleDateString("vi-VN")}</Text>}
              </View>
            </Card>
          )}
          {entitlement?.isPremium && <View style={styles.actions}>
            <Button title="Nhiệm vụ đặc biệt" onPress={() => router.push("/(tabs)/mission/premium/special")} icon="flag-outline" />
            <Button title="Nhiệm vụ nhóm" onPress={() => router.push("/(tabs)/mission/premium/groups")} icon="people-outline" variant="secondary" />
            <Button title="Voucher Premium" onPress={() => router.push("/(tabs)/mission/premium/vouchers")} icon="ticket-outline" variant="outline" />
          </View>}
          {checkoutEnabled && <View style={styles.list}>
            {plans.map((plan) => {
              const monthly = plan.priceVnd / plan.durationMonths;
              const isBest = plan.durationMonths === 12;
              return (
                <Card key={plan.id} style={{ ...styles.planCard, ...(isBest ? styles.bestCard : {}) }}>
                  <View style={styles.planTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.planName, isBest && styles.bestText]}>{planDuration(plan)}</Text>
                      <Text style={[styles.body, isBest && styles.bestSubtext]}>Toàn bộ quyền lợi Premium</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.price, isBest && styles.bestText]}>{formatVnd(plan.priceVnd)}</Text>
                      {plan.durationMonths > 1 && <Text style={[styles.monthly, isBest && styles.bestSubtext]}>~ {formatVnd(Math.round(monthly))}/tháng</Text>}
                    </View>
                  </View>
                  <Button
                    title={entitlement?.isPremium ? `Gia hạn thêm ${planDuration(plan)}` : "Chọn gói"}
                    onPress={() => void startPayment(plan)}
                    loading={pendingCode === plan.code}
                    disabled={pendingCode !== null}
                    variant={isBest ? "amber" : "primary"}
                  />
                </Card>
              );
            })}
          </View>}
          <Card style={styles.benefits}><PremiumBenefits /></Card>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing(1.25) },
  planCard: { gap: spacing(1.25), padding: spacing(1.75), backgroundColor: colors.blueSoft },
  bestCard: { backgroundColor: colors.navyCard, borderColor: colors.gold },
  planTop: { flexDirection: "row", gap: spacing(1) },
  planName: { color: colors.navy, fontSize: 18, fontWeight: "800" },
  price: { color: colors.navy, fontSize: 24, fontWeight: "800" },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  monthly: { color: colors.textMuted, fontSize: 12 },
  bestText: { color: "#FFFFFF" },
  bestSubtext: { color: "rgba(255,255,255,0.78)" },
  activeCard: { flexDirection: "row", gap: spacing(1), alignItems: "center" },
  activeTitle: { color: colors.navy, fontWeight: "800", fontSize: 15 },
  benefits: { marginTop: spacing(1), padding: spacing(1.5) },
  actions: { gap: spacing(0.75) },
  paymentCard: { alignItems: "center", gap: spacing(1.25), padding: spacing(2) },
  qr: { width: 220, height: 220, backgroundColor: "#FFFFFF" },
  center: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  renewalHint: { color: colors.navy, fontSize: 13, textAlign: "center", lineHeight: 19, fontWeight: "700" },
  transfer: { color: colors.navy, fontSize: 17, fontWeight: "800", letterSpacing: 0.5 },
  status: { color: colors.textMuted, fontSize: 13 },
  success: { alignItems: "center", gap: spacing(1) },
  successTitle: { color: colors.navy, fontSize: 19, fontWeight: "800" },
});
