import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { changeTripLifecycle, getTripSummary } from "@/api/endpoints/itinerary";
import { useLocale } from "@/i18n/LocaleContext";

export function TripLifecycleActions({ tripId }: { tripId: string }) {
  const { locale } = useLocale(); const vi = locale === "vi";
  const [state, setState] = useState(""); const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  useFocusEffect(useCallback(() => { let active = true; getTripSummary(tripId).then(s => { if (active) setState(s.lifecycle.status ?? "PLANNED"); }).catch(() => {}); return () => { active = false; }; }, [tripId]));
  async function act(action: "COMPLETE" | "CANCEL") {
    if (busy) return; setBusy(true);
    try { const s = await changeTripLifecycle(tripId, action); setState(s.status); const totals = await getTripSummary(tripId); setSummary(`${vi ? "Dự toán" : "Estimated"}: ${totals.estimated_total.toLocaleString()} VND · ${vi ? "Chi thực tự khai" : "Self-reported actual"}: ${totals.self_reported_actual_total.toLocaleString()} VND`); }
    catch (e) { Alert.alert(vi ? "Chưa thể cập nhật" : "Unable to update", e instanceof Error ? e.message : "Please try again"); }
    finally { setBusy(false); }
  }
  return <View style={{ paddingVertical: 14, gap: 10 }}>
    {!!state && <Text>{vi ? "Trạng thái chuyến đi" : "Trip status"}: {state}</Text>}
    {state !== "COMPLETED" && state !== "CANCELLED" && <View style={{ flexDirection: "row", gap: 20 }}><Pressable disabled={busy} onPress={() => Alert.alert(vi ? "Kết thúc chuyến đi?" : "Complete trip?", vi ? "Voucher chưa dùng vẫn được giữ đến ngày hết hạn." : "Unused vouchers remain valid until expiry.", [{ text: vi ? "Quay lại" : "Back" }, { text: vi ? "Xác nhận" : "Confirm", onPress: () => void act("COMPLETE") }])}><Text>{vi ? "Hoàn tất chuyến đi" : "Complete trip"}</Text></Pressable><Pressable disabled={busy} onPress={() => Alert.alert(vi ? "Hủy chuyến đi?" : "Cancel trip?", "", [{ text: vi ? "Quay lại" : "Back" }, { text: vi ? "Xác nhận" : "Confirm", onPress: () => void act("CANCEL") }])}><Text>{vi ? "Hủy chuyến" : "Cancel trip"}</Text></Pressable></View>}
    {!!summary && <Text>{summary}</Text>}
  </View>;
}
