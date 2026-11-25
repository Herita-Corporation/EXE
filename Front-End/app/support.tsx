import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { request } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";

export default function SupportScreen() {
  const { voucherId } = useLocalSearchParams<{ voucherId?: string }>(); const { locale } = useLocale(); const vi = locale === "vi";
  const [description, setDescription] = useState(""); const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<{ id: string; description: string; status: string }[]>([]);
  async function send() { if (busy || !description.trim()) return; setBusy(true); try { const r = await request<{ id: string }>("task", "/api/v2/me/support-tickets", { method: "POST", data: { voucherId: voucherId ?? null, category: voucherId ? "VOUCHER" : "GENERAL", description } }); setDescription(""); Alert.alert(vi ? "Đã gửi yêu cầu" : "Request received", r.id); } catch (e) { Alert.alert(vi ? "Chưa gửi được" : "Unable to send", e instanceof Error ? e.message : "Please try again"); } finally { setBusy(false); } }
  async function load() { try { setTickets(await request("task", "/api/v2/me/support-tickets")); } catch (e) { Alert.alert("DISA", e instanceof Error ? e.message : "Unable to load"); } }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}><Text style={{ fontSize: 24, fontWeight: "700" }}>{vi ? "Phản hồi & hỗ trợ" : "Feedback & support"}</Text><Text>{vi ? "Không gửi mật khẩu, mã QR đang sử dụng hoặc thông tin thanh toán nhạy cảm." : "Do not send passwords, active QR codes or sensitive payment details."}</Text><TextInput multiline maxLength={2000} value={description} onChangeText={setDescription} placeholder={vi ? "Mô tả vấn đề…" : "Describe the issue…"} style={{ borderWidth: 1, borderColor: "#718296", borderRadius: 12, padding: 14, minHeight: 140, textAlignVertical: "top" }} /><Pressable disabled={busy || !description.trim()} onPress={send}><Text>{busy ? "…" : vi ? "Gửi phản hồi" : "Send feedback"}</Text></Pressable><Pressable onPress={load}><Text>{vi ? "Xem yêu cầu của tôi" : "View my requests"}</Text></Pressable>{tickets.map(t => <Text key={t.id}>{t.status} · {t.description}</Text>)}</ScrollView>;
}
