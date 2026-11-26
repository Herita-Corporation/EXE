import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getEarnedPremiumOffers } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors } from "@/theme/colors";
import type { EarnedPremiumOffer } from "@/types/premium";

export default function PremiumOffersScreen() {
  const [items, setItems] = useState<EarnedPremiumOffer[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setItems(await getEarnedPremiumOffers()); setError(null); } catch (e) { setError(e instanceof ApiError ? e.message : "Không thể tải ưu đãi Premium."); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function openOffer(item: EarnedPremiumOffer) {
    try {
      const canOpen = await Linking.canOpenURL(item.offer.publicUrl);
      if (!canOpen) throw new Error("Unsupported public offer URL");
      await Linking.openURL(item.offer.publicUrl);
    } catch {
      setError("Không thể mở liên kết ưu đãi của đối tác.");
    }
  }
  return <ScreenContainer><BackHeader title="Ưu đãi Premium" onBack={() => router.back()} /><ErrorBanner message={error} />{loading ? <ActivityIndicator color={colors.navy} /> : items.length === 0 ? <Text style={styles.copy}>Hoàn thành nhiệm vụ đặc biệt hoặc nhiệm vụ nhóm để mở ưu đãi của đối tác.</Text> : items.map((item) => <Card key={item.offer.id}><Text style={styles.title}>{item.offer.title}</Text><Text style={styles.provider}>{item.offer.provider}</Text><Text style={styles.copy}>{item.offer.benefit}</Text><Text style={styles.copy}>{item.offer.terms}</Text><Button title="Mở ưu đãi" size="sm" icon="open-outline" iconPosition="right" onPress={() => void openOffer(item)} /></Card>)}</ScreenContainer>;
}
const styles = StyleSheet.create({ title: { color: colors.navy, fontSize: 16, fontWeight: "800" }, provider: { color: colors.navy, fontSize: 13, fontWeight: "700" }, copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 } });
