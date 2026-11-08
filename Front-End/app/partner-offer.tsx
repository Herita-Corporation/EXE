import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { request } from "@/api/http";
import { claimPartnerVoucher } from "@/api/endpoints/partnerVouchers";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";

interface PublicOffer { campaignId: string; title: string; terms: string; partnerName: string; address: string; availableToClaim: number }
export default function PartnerOfferScreen() {
  const params = useLocalSearchParams<{ qrKey?: string; context?: string }>(); const { user } = useAuth(); const { locale } = useLocale(); const vi = locale === "vi";
  const key = typeof params.qrKey === "string" ? params.qrKey : ""; const context = typeof params.context === "string" ? params.context : null;
  const [offer, setOffer] = useState<PublicOffer | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; setOffer(null); setError(""); if (key) request<PublicOffer>("task", "/api/v2/public/qr/" + encodeURIComponent(key), { auth: false }).then(o => { if (active) setOffer(o); }).catch(e => { if (active) setError(e.message); }); else setError(vi ? "Vui lòng quét lại QR tại quán." : "Please scan the venue QR again."); return () => { active = false; }; }, [key, vi]);
  async function receive() {
    if (!offer || busy) return;
    if (!user) { await AsyncStorage.setItem("disa.pendingPartnerOffer", JSON.stringify({ qrKey: key, context, expiresAt: Date.now() + 7 * 86400000 })); router.push("/(auth)/login"); return; }
    setBusy(true);
    try {
      let ctx = context;
      if (!ctx) { const c = await request<{ acquisitionContextToken: string }>("task", "/api/v2/public/acquisition-contexts", { method: "POST", data: key, auth: false }); ctx = c.acquisitionContextToken; }
      await claimPartnerVoucher(user.id, offer.campaignId, ctx); await AsyncStorage.removeItem("disa.pendingPartnerOffer"); router.replace("/partner-vouchers");
    } catch (e) { Alert.alert(vi ? "Chưa nhận được ưu đãi" : "Unable to claim", e instanceof Error ? e.message : "Please try again"); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}><Text style={{ fontSize: 24, fontWeight: "700" }}>DISA · {vi ? "Ưu đãi tại cơ sở" : "Venue offer"}</Text>{!!error && <Text>{error}</Text>}{offer && <><Text style={{ fontSize: 22 }}>{offer.title}</Text><Text>{offer.partnerName} · {offer.address}</Text><Text>{offer.terms}</Text><Text>{offer.availableToClaim > 0 ? (vi ? "Suất được giữ khi nhận thành công." : "A slot is reserved only after successful claim.") : (vi ? "Đã hết lượt nhận. Nếu đã lưu, kiểm tra ví của bạn." : "No new claims available. Check your wallet if already claimed.")}</Text><Pressable disabled={busy} onPress={receive}><Text>{busy ? "…" : user ? (vi ? "Nhận / xem voucher của tôi" : "Claim / view my voucher") : (vi ? "Đăng nhập để nhận voucher" : "Sign in to claim")}</Text></Pressable><Pressable onPress={() => router.push("/partner-vouchers")}><Text>{vi ? "Mở ví voucher" : "Open wallet"}</Text></Pressable></>}</ScrollView>;
}
