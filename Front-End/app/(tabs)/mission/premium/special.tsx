import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { acceptSpecialMissions, getPremiumProvinces, getSpecialMissions } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, radius, spacing } from "@/theme/colors";
import type { PremiumMission, PremiumProvince } from "@/types/premium";

export default function PremiumSpecialScreen() {
  const [provinces, setProvinces] = useState<PremiumProvince[]>([]);
  const [province, setProvince] = useState<PremiumProvince | null>(null);
  const [missions, setMissions] = useState<PremiumMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (province) setMissions(await getSpecialMissions(province.id));
      else setProvinces(await getPremiumProvinces());
    } catch (e) { setError(e instanceof ApiError ? e.message : "Không thể tải nhiệm vụ Premium."); }
    finally { setLoading(false); }
  }, [province]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function acceptAll() {
    if (!province) return;
    setSaving(true); setError(null);
    try { setMissions(await acceptSpecialMissions(province.id)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Không thể nhận nhiệm vụ."); }
    finally { setSaving(false); }
  }

  return <ScreenContainer>
    <BackHeader title="Nhiệm vụ đặc biệt" onBack={() => province ? setProvince(null) : router.back()} />
    <Text style={styles.copy}>Chọn tỉnh/thành, nhận nhiệm vụ và nộp đúng loại minh chứng để mở khóa voucher 0 DisaPoint.</Text>
    <ErrorBanner message={error} />
    {loading ? <ActivityIndicator color={colors.navy} /> : !province ? <View style={styles.grid}>
      {provinces.map(p => <Pressable key={p.id} style={({ pressed }) => [styles.province, pressed && styles.pressed]} onPress={() => setProvince(p)}><Text style={styles.provinceText}>{p.name}</Text><Ionicons name="chevron-forward" color={colors.textMuted} size={16} /></Pressable>)}
    </View> : <>
      <Card style={styles.headerCard}><View style={{ flex: 1 }}><Text style={styles.title}>{province.name}</Text><Text style={styles.copy}>{missions.filter(m => m.accepted).length}/{missions.length} nhiệm vụ đã nhận</Text></View><Button title="Nhận tất cả" size="sm" onPress={() => void acceptAll()} loading={saving} /></Card>
      {missions.map(m => <Pressable key={m.id} style={({ pressed }) => [styles.mission, pressed && styles.pressed]} disabled={!m.accepted || !!m.completedAt} onPress={() => router.push({ pathname: "/(tabs)/mission/premium/evidence/[missionId]", params: { missionId: m.id, scope: "special", scopeId: province.id, title: m.title, evidenceType: m.evidenceType } })}>
        <Ionicons name={m.completedAt ? "checkmark-circle" : m.evidenceType === "video" ? "videocam-outline" : "image-outline"} size={24} color={m.completedAt ? colors.success : colors.navy} />
        <View style={{ flex: 1 }}><Text style={styles.missionTitle}>{m.title}</Text><Text style={styles.copy}>{m.instruction}</Text></View><Ionicons name={m.accepted ? "chevron-forward" : "lock-closed-outline"} size={18} color={colors.textMuted} />
      </Pressable>)}
    </>}
  </ScreenContainer>;
}
const styles = StyleSheet.create({ copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, grid: { gap: spacing(1) }, province: { padding: spacing(1.5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between" }, provinceText: { color: colors.navy, fontWeight: "700" }, headerCard: { flexDirection: "row", alignItems: "center", gap: spacing(1) }, title: { color: colors.navy, fontWeight: "800", fontSize: 17 }, mission: { flexDirection: "row", gap: spacing(1), alignItems: "center", padding: spacing(1.25), borderRadius: radius.md, backgroundColor: colors.blueSoft }, missionTitle: { color: colors.navy, fontWeight: "700" }, pressed: { opacity: 0.7 } });
