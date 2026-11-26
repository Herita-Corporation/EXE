import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getPremiumVirtualVouchers } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors } from "@/theme/colors";
import type { PremiumVirtualVoucher } from "@/types/premium";

export default function PremiumVouchersScreen() {
  const [items, setItems] = useState<PremiumVirtualVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getPremiumVirtualVouchers()); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Không thể tải voucher Premium."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function openVoucher(item: PremiumVirtualVoucher) {
    try {
      if (!await Linking.canOpenURL(item.publicUrl)) throw new Error("Unsupported URL");
      await Linking.openURL(item.publicUrl);
    } catch { setError("Không thể mở liên kết công khai của đối tác."); }
  }
  return <ScreenContainer>
    <BackHeader title="Voucher Premium" onBack={() => router.back()} />
    <Text style={styles.notice}>Voucher trong mục này là ưu đãi demo theo liên kết công khai, không có mã giảm giá hay xác nhận đặt chỗ.</Text>
    <ErrorBanner message={error} />
    {loading ? <ActivityIndicator color={colors.navy} /> : items.length === 0 ? <Text style={styles.copy}>Hoàn thành nhiệm vụ đặc biệt để nhận voucher demo của đối tác.</Text> : items.map((item) => <Card key={item.id}>
      <Text style={styles.title}>{item.title}</Text><Text style={styles.provider}>{item.provider}</Text>
      <Text style={styles.copy}>{item.benefit}</Text><Text style={styles.copy}>{item.terms}</Text>
      <Text style={styles.mission}>Từ nhiệm vụ: {item.missionTitle} · {item.areaName}</Text>
      <Button title="Mở ưu đãi" size="sm" icon="open-outline" iconPosition="right" onPress={() => void openVoucher(item)} />
    </Card>)}
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  title: { color: colors.navy, fontSize: 16, fontWeight: "800" }, provider: { color: colors.navy, fontSize: 13, fontWeight: "700" },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, mission: { color: colors.link, fontSize: 12 },
  notice: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
