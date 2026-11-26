import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { createPremiumGroup, getPremiumGroups, getPremiumProvinces } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Input } from "@/components/Input";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, radius, spacing } from "@/theme/colors";
import type { PremiumGroup, PremiumProvince } from "@/types/premium";

export default function PremiumGroupsScreen() {
  const [groups, setGroups] = useState<PremiumGroup[]>([]); const [provinces, setProvinces] = useState<PremiumProvince[]>([]);
  const [province, setProvince] = useState<string | null>(null); const [accounts, setAccounts] = useState("");
  const [editing, setEditing] = useState(false); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const [g, p] = await Promise.all([getPremiumGroups(), getPremiumProvinces()]); setGroups(g); setProvinces(p); setError(null); } catch (e) { setError(e instanceof ApiError ? e.message : "Không thể tải nhóm Premium."); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function create() {
    if (!province) return; setSaving(true); setError(null);
    try { const group = await createPremiumGroup(province, accounts.split(/[\n,]+/).map(x => x.trim()).filter(Boolean)); setEditing(false); setAccounts(""); router.push({ pathname: "/(tabs)/mission/premium/group/[groupId]", params: { groupId: group.id } }); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Không thể tạo nhóm."); } finally { setSaving(false); }
  }
  return <ScreenContainer><BackHeader title={editing ? "Tạo nhóm Premium" : "Nhiệm vụ nhóm"} onBack={() => editing ? setEditing(false) : router.back()} /><ErrorBanner message={error} />
    {loading ? <ActivityIndicator color={colors.navy} /> : editing ? <>
      <Text style={styles.copy}>Mỗi thành viên phải có Premium còn hiệu lực. Nhập username hoặc email của các thành viên khác, mỗi người một dòng.</Text>
      <View style={styles.provinces}>{provinces.map(p => <Pressable key={p.id} onPress={() => setProvince(p.id)} style={[styles.province, province === p.id && styles.selected]}><Text style={styles.provinceText}>{p.name}</Text></Pressable>)}</View>
      <Input label="Thành viên" value={accounts} onChangeText={setAccounts} multiline placeholder="nguyen-a&#10;ban@example.com" />
      <Button title="Tạo nhóm" onPress={() => void create()} loading={saving} disabled={!province || !accounts.trim()} icon="people-outline" />
    </> : <>
      <Text style={styles.copy}>Một người nộp minh chứng sẽ hoàn thành nhiệm vụ cho cả nhóm. Ưu đãi đối tác phù hợp sẽ được mở khóa cho từng thành viên.</Text>
      <Button title="Tạo nhóm" onPress={() => setEditing(true)} icon="add" />
      {groups.map(g => <Pressable key={g.id} style={({ pressed }) => [styles.group, pressed && { opacity: 0.7 }]} onPress={() => router.push({ pathname: "/(tabs)/mission/premium/group/[groupId]", params: { groupId: g.id } })}><View style={{ flex: 1 }}><Text style={styles.groupTitle}>{g.provinceName}</Text><Text style={styles.copy}>{g.members.map(m => m.username).join(", ")}</Text><Text style={styles.copy}>{g.completedCount}/8 nhiệm vụ hoàn thành</Text></View></Pressable>)}
    </>}</ScreenContainer>;
}
const styles = StyleSheet.create({ copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, provinces: { flexDirection: "row", flexWrap: "wrap", gap: spacing(0.75) }, province: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing(1), paddingVertical: spacing(0.75), borderRadius: radius.pill }, selected: { borderColor: colors.primary, backgroundColor: colors.blueSoft }, provinceText: { color: colors.navy, fontWeight: "600" }, group: { padding: spacing(1.5), borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }, groupTitle: { fontSize: 16, color: colors.navy, fontWeight: "800" } });
