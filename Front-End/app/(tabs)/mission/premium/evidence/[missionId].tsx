import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { submitPremiumMission } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, spacing } from "@/theme/colors";

export default function PremiumEvidenceScreen() {
  const { missionId, scope, scopeId, title, evidenceType } = useLocalSearchParams<{ missionId: string; scope: "special" | "groups"; scopeId: string; title: string; evidenceType: "photo" | "video" }>();
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const photo = evidenceType !== "video";
  async function pick() {
    const permission = photo ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError("Cần cấp quyền để chọn minh chứng."); return; }
    const result = photo ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 }) : await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: 60 });
    if (result.canceled) return;
    setSaving(true); setError(null);
    try { await submitPremiumMission(scope, scopeId, missionId, { uri: result.assets[0].uri, type: photo ? "photo" : "video" }); Alert.alert("Đã hoàn thành", "Ưu đãi đối tác công khai đã được mở khóa trong mục Premium.", [{ text: "OK", onPress: () => router.back() }]); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Không thể gửi minh chứng."); }
    finally { setSaving(false); }
  }
  return <ScreenContainer><BackHeader title="Nộp minh chứng" onBack={() => router.back()} /><Text style={styles.title}>{title}</Text><Text style={styles.copy}>Nộp một {photo ? "ảnh" : "video"} thật đúng yêu cầu. Sau khi máy chủ xác nhận tệp hợp lệ, ưu đãi đối tác sẽ được mở khóa.</Text><ErrorBanner message={error} /><View style={styles.action}><Button title={photo ? "Chọn ảnh" : "Quay video"} icon={photo ? "image-outline" : "videocam-outline"} onPress={() => void pick()} loading={saving} /></View></ScreenContainer>;
}
const styles = StyleSheet.create({ title: { color: colors.navy, fontWeight: "800", fontSize: 19 }, copy: { color: colors.textMuted, fontSize: 14, lineHeight: 21 }, action: { marginTop: spacing(2) } });
