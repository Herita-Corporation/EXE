import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Linking } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getEarnedPremiumVouchers, redeemPremiumMission } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, spacing } from "@/theme/colors";
import type { EarnedPremiumVoucher } from "@/types/premium";

export default function PremiumVouchersScreen() {
  const [items, setItems] = useState<EarnedPremiumVoucher[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setItems(await getEarnedPremiumVouchers()); setError(null); } catch (e) { setError(e instanceof ApiError ? e.message : "Không thể tải voucher Premium."); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function redeem(item: EarnedPremiumVoucher) {
    try { const result = await redeemPremiumMission(item.scope, item.scopeId, item.missionId); if (result.redemptionUrl) await Linking.openURL(result.redemptionUrl); else Alert.alert("Mã voucher", result.code); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Không thể đổi voucher."); }
  }
  return <ScreenContainer><BackHeader title="Voucher Premium" onBack={() => router.back()} /><ErrorBanner message={error} />{loading ? <ActivityIndicator color={colors.navy} /> : items.length === 0 ? <Text style={styles.copy}>Hoàn thành nhiệm vụ đặc biệt hoặc nhiệm vụ nhóm để nhận voucher 0 DisaPoint.</Text> : items.map((item) => <Card key={item.voucher.id}><Text style={styles.title}>{item.voucher.title}</Text><Text style={styles.copy}>{item.voucher.benefit}</Text><Text selectable style={styles.code}>{item.voucher.code}</Text><Text style={styles.copy}>{item.voucher.terms}</Text><Button title="Đổi voucher" size="sm" onPress={() => void redeem(item)} /></Card>)}</ScreenContainer>;
}
const styles = StyleSheet.create({ title: { color: colors.navy, fontSize: 16, fontWeight: "800" }, copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, code: { color: colors.navy, fontSize: 17, fontWeight: "800", letterSpacing: 1, marginVertical: spacing(0.5) } });
