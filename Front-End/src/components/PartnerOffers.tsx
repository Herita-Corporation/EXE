import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import { listPartnerOffers, claimPartnerVoucher, PartnerOffer } from "@/api/endpoints/partnerVouchers";
import { colors } from "@/theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function PartnerOffers({ locationId, tripId }: { locationId?: string; tripId?: string }) {
  const { user } = useAuth(); const { locale } = useLocale(); const vi = locale === "vi";
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { let active = true; if (user && !locationId && !tripId) AsyncStorage.getItem("disa.pendingPartnerOffer").then(async raw => { if (!raw || !active) return; let p; try { p = JSON.parse(raw); } catch { return; } await AsyncStorage.removeItem("disa.pendingPartnerOffer"); if (active && typeof p.qrKey === "string" && p.expiresAt > Date.now()) router.push({ pathname: "/partner-offer", params: { qrKey: p.qrKey, context: p.context ?? "" } }); }); return () => { active = false; }; }, [user?.id, locationId, tripId]));
  const load = useCallback(() => { if (!user) { setOffers([]); return; } return listPartnerOffers(locationId, tripId).then(x => { setOffers(x); setError(""); }).catch(e => { setOffers([]); setError(e.message); }); }, [user?.id, locationId, tripId]);
  useFocusEffect(useCallback(() => { let active = true; setOffers([]); setError(""); if (user) listPartnerOffers(locationId, tripId).then(x => { if (active) setOffers(x); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [user?.id, locationId, tripId]));
  async function save(offer: PartnerOffer) {
    if (!user || busy) return;
    if (offer.ownedVoucherId) { router.push("/partner-vouchers"); return; }
    setBusy(offer.campaignId);
    try { await claimPartnerVoucher(user.id, offer.campaignId, null, tripId ?? null); await load(); Alert.alert(vi ? "Đã lưu voucher" : "Voucher saved", vi ? "Hạn dùng tính từ lúc nhận. Xem mã trong ví ưu đãi đối tác." : "Validity starts when claimed. Find it in your partner wallet."); }
    catch (e) { Alert.alert(vi ? "Chưa lưu được" : "Unable to save", e instanceof Error ? e.message : "Please try again"); await load(); }
    finally { setBusy(null); }
  }
  return <View style={{ padding: 16, gap: 12 }}>
    <Pressable onPress={() => router.push("/partner-vouchers")} accessibilityRole="button"><Text style={{ fontSize: 20, fontWeight: "700", color: colors.primary }}>{vi ? "Ưu đãi từ đối tác · Mở ví →" : "Partner offers · Open wallet →"}</Text></Pressable>
    {!!error && <Text style={{ color: colors.textMuted }}>{error}</Text>}
    {!error && !offers.length && <Text>{vi ? "Chưa có ưu đãi đối tác khả dụng." : "No partner offers available."}</Text>}
    {offers.map(o => <View key={o.campaignId} style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, gap: 8 }}>
      <Text style={{ fontWeight: "700", fontSize: 18 }}>{o.title}</Text><Text>{o.partnerName} · {o.address}</Text><Text>{o.terms}</Text>
      <Text>{vi ? "Hạn nhận: " : "Claim by: "}{new Date(o.claimEndsAt).toLocaleString()} · {vi ? "Dùng không quá: " : "Use no later than: "}{new Date(o.redeemEndsAt).toLocaleString()}</Text>
      <Text>{o.validityDescription}</Text>
      <Pressable disabled={!!busy} onPress={() => save(o)} accessibilityRole="button" style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 10, opacity: busy ? .6 : 1 }}><Text style={{ color: "white", fontWeight: "700" }}>{busy === o.campaignId ? "…" : o.ownedVoucherId ? (vi ? "Đã lưu · Xem voucher" : "Saved · View voucher") : (vi ? "Lưu voucher" : "Save voucher")}</Text></Pressable>
    </View>)}
  </View>;
}
