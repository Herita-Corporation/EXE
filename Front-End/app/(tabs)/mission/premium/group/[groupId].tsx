import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPremiumGroup } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, radius, spacing } from "@/theme/colors";
import type { PremiumGroupDetail } from "@/types/premium";

export default function PremiumGroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>(); const [group, setGroup] = useState<PremiumGroupDetail | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { setGroup(await getPremiumGroup(groupId)); setError(null); } catch (e) { setError(e instanceof ApiError ? e.message : "Không thể tải nhóm."); } }, [groupId]); useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <ScreenContainer><BackHeader title={group?.provinceName ?? "Nhiệm vụ nhóm"} onBack={() => router.back()} /><ErrorBanner message={error} />{!group ? <ActivityIndicator color={colors.navy} /> : <><View style={styles.members}><Text style={styles.title}>{group.completedCount}/8 nhiệm vụ hoàn thành</Text><Text style={styles.copy}>{group.members.map(x => x.username).join(", ")}</Text></View>{group.missions.map(m => <Pressable key={m.id} disabled={!!m.completedAt} onPress={() => router.push({ pathname: "/(tabs)/mission/premium/evidence/[missionId]", params: { missionId: m.id, scope: "groups", scopeId: group.id, title: m.title, evidenceType: m.evidenceType } })} style={styles.mission}><Ionicons name={m.completedAt ? "checkmark-circle" : m.evidenceType === "video" ? "videocam-outline" : "image-outline"} size={23} color={m.completedAt ? colors.success : colors.navy} /><View style={{ flex: 1 }}><Text style={styles.title}>{m.title}</Text><Text style={styles.copy}>{m.instruction}</Text></View></Pressable>)}</>}</ScreenContainer>;
}
const styles = StyleSheet.create({ members: { padding: spacing(1.25), borderRadius: radius.md, backgroundColor: colors.blueSoft }, mission: { flexDirection: "row", gap: spacing(1), alignItems: "center", padding: spacing(1.25), borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, title: { color: colors.navy, fontWeight: "800" }, copy: { color: colors.textMuted, fontSize: 13, lineHeight: 18 } });
