import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, View, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import * as api from "@/api/endpoints/partnerVouchers";
import { colors } from "@/theme/colors";

export default function PartnerWalletScreen() {
  const { user } = useAuth(); const { locale } = useLocale(); const vi = locale === "vi";
  const [bucket, setBucket] = useState<"active" | "history">("active");
  const [items, setItems] = useState<api.PartnerVoucher[]>([]); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<api.VoucherPresentation | null>(null);
  const [remaining, setRemaining] = useState(0); const [busy, setBusy] = useState(false);
  const foreground = useRef(true); const polling = useRef(false);
  const activeAccount = useRef(user?.id); activeAccount.current = user?.id;
  const activeBucket = useRef(bucket); activeBucket.current = bucket;
  const reload = useCallback(async () => { if (!user) return; const uid = user.id; try { const result = await api.partnerWallet(bucket); if (activeAccount.current === uid && activeBucket.current === bucket) { setItems(result); setError(""); } } catch (e) { if (activeAccount.current === uid && activeBucket.current === bucket) setError(e instanceof Error ? e.message : "Unable to load"); } }, [user?.id, bucket]);
  useFocusEffect(useCallback(() => { setItems([]); setPresentation(null); setSelected(null); void reload(); return () => { setPresentation(null); setSelected(null); }; }, [reload]));
  useEffect(() => { setPresentation(null); setSelected(null); }, [user?.id]);
  useEffect(() => { const sub = AppState.addEventListener("change", s => { foreground.current = s === "active"; if (s !== "active") { setPresentation(null); setSelected(null); } else void reload(); }); return () => sub.remove(); }, [reload]);
  useEffect(() => {
    if (!presentation || !selected) return;
    const duration = new Date(presentation.expiresAt).getTime() - new Date(presentation.serverNow).getTime();
    const end = Date.now() + duration; let disposed = false;
    const timer = setInterval(async () => {
      const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000)); setRemaining(seconds);
      if (!seconds) { setPresentation(null); setSelected(null); void reload(); return; }
      if (!foreground.current || polling.current || seconds % 3 !== 0) return;
      polling.current = true;
      try { const v = await api.partnerVoucher(selected); if (!disposed && !v.canPresent) { setPresentation(null); setSelected(null); void reload(); } }
      catch { /* expiry remains fail-closed; no automatic QR refresh */ }
      finally { polling.current = false; }
    }, 1000);
    return () => { disposed = true; clearInterval(timer); };
  }, [presentation, selected, reload]);
  async function show(v: api.PartnerVoucher) {
    if (busy) return; setBusy(true); setPresentation(null);
    try { const p = await api.presentPartnerVoucher(v.voucherId); setSelected(v.voucherId); setRemaining(Math.ceil((new Date(p.expiresAt).getTime() - new Date(p.serverNow).getTime()) / 1000)); setPresentation(p); }
    catch (e) { Alert.alert(vi ? "Không thể tạo mã" : "Unable to present", e instanceof Error ? e.message : "Please try again"); void reload(); }
    finally { setBusy(false); }
  }
  const status = (v: api.PartnerVoucher) => v.status === "REDEEMED" ? (vi ? "Đã sử dụng" : "Used") : v.status === "EXPIRED" ? (vi ? "Hết hạn" : "Expired") : v.status === "REVOKED" ? (vi ? "Đã thu hồi" : "Revoked") : v.displayState === "WAITING_FOR_NEXT_VISIT" ? (vi ? "Chưa đến ngày sử dụng" : "Not yet valid") : v.canPresent ? (vi ? "Có thể sử dụng" : "Ready to use") : (vi ? "Tạm ngừng" : "Suspended");
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 24, fontWeight: "700" }}>{vi ? "Ví ưu đãi đối tác" : "Partner voucher wallet"}</Text>
    {!user && <Pressable onPress={() => router.push("/(auth)/login")}><Text>{vi ? "Đăng nhập để xem voucher" : "Sign in to see your vouchers"}</Text></Pressable>}
    <View style={{ flexDirection: "row", gap: 20 }}>{(["active", "history"] as const).map(b => <Pressable key={b} onPress={() => setBucket(b)}><Text style={{ color: bucket === b ? colors.primary : colors.textMuted, fontWeight: "700" }}>{b === "active" ? (vi ? "Voucher của tôi" : "My vouchers") : (vi ? "Voucher hết hạn" : "Used & expired")}</Text></Pressable>)}</View>
    {bucket === "history" && <Text>{vi ? "Đã sử dụng, hết hạn hoặc không còn hiệu lực" : "Used, expired or revoked vouchers"}</Text>}
    <Pressable onPress={reload}><Text>{vi ? "Làm mới" : "Refresh"}</Text></Pressable>{!!error && <Text>{error}</Text>}
    <Pressable onPress={() => router.push("/support")}><Text>{vi ? "Phản hồi / hỗ trợ ưu đãi" : "Feedback / voucher support"}</Text></Pressable>
    {presentation && <View style={{ alignItems: "center", backgroundColor: "white", padding: 20, gap: 12 }}><QRCode value={presentation.qrPayload} size={210} /><Text selectable>{presentation.shortCode}</Text><Text>{remaining}s · {vi ? "Chỉ đưa mã cho nhân viên tại quầy" : "Show only to venue staff"}</Text><Pressable onPress={() => { if (selected) void api.revokePartnerPresentation(selected).catch(() => {}); setPresentation(null); setSelected(null); }}><Text>{vi ? "Đóng mã" : "Close code"}</Text></Pressable></View>}
    {items.map(v => <View key={v.voucherId} style={{ padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, gap: 8 }}><Text style={{ fontSize: 18, fontWeight: "700" }}>{v.title}</Text><Text>{v.locationName} · {v.address}</Text><Text style={{ fontWeight: "700" }}>{status(v)}</Text><Text>{v.terms}</Text><Text>{vi ? "Có hiệu lực từ: " : "Valid from: "}{new Date(v.redeemableFrom).toLocaleString()}</Text><Text>{vi ? "Hết hạn: " : "Expires: "}{new Date(v.expiresAt).toLocaleString()}</Text><Text selectable>{v.voucherRef}</Text>
      {v.canPresent && <Pressable disabled={busy} onPress={() => show(v)}><Text style={{ color: colors.primary }}>{vi ? "Sử dụng tại quầy · Tạo QR" : "Use at venue · Create QR"}</Text></Pressable>}
      {v.status === "ISSUED" && <Pressable onPress={() => router.push("/(tabs)/mission/create?from=home")}><Text>{vi ? "Lên kế hoạch chuyến đi" : "Plan a trip"}</Text></Pressable>}
    </View>)}
  </ScrollView>;
}
