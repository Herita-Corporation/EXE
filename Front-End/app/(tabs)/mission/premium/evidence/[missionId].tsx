import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { submitPremiumMission } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, spacing } from "@/theme/colors";

export default function PremiumEvidenceScreen() {
  const { missionId, scope, scopeId, title, evidenceType, gps, instruction } = useLocalSearchParams<{ missionId: string; scope: "special" | "groups"; scopeId: string; title: string; gps?: string; instruction?: string; evidenceType: "photo" | "video" }>();
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const photo = evidenceType !== "video";
  async function pick() {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error("Cần cấp quyền camera để ghi minh chứng tại chỗ.");
      if (gps === "1" && !(await Location.requestForegroundPermissionsAsync()).granted) throw new Error("Nhiệm vụ cần quyền vị trí chính xác khi dùng ứng dụng.");
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: photo ? ["images"] : ["videos"], quality: 0.8, videoMaxDuration: 60 });
      if (result.canceled) return;
      const loc = gps === "1" ? await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.High}) : null;
      if (loc && (loc.mocked || !loc.coords.accuracy || loc.coords.accuracy > 65)) throw new Error("Chưa có tín hiệu GPS đủ chính xác. Hãy thử tại nơi thoáng.");
      const completed = await submitPremiumMission(scope, scopeId, missionId, { uri: result.assets[0].uri, type: photo ? "photo" : "video" },
        loc ? {latitude:loc.coords.latitude, longitude:loc.coords.longitude, accuracy:loc.coords.accuracy!, capturedAtUtc:new Date(loc.timestamp).toISOString()} : undefined);
      Alert.alert("Đã hoàn thành", "Xem thưởng trong ví ưu đãi đối tác hoặc mục voucher demo Premium." + (completed.bonusPoints ? " +" + completed.bonusPoints + " điểm khung giờ." : ""), [{text:"OK", onPress:()=>router.back()}]);
    } catch (e) { setError(e instanceof ApiError || e instanceof Error ? e.message : "Không thể gửi minh chứng."); }
    finally { setSaving(false); }
  }
  return <ScreenContainer><BackHeader title="Nộp minh chứng" onBack={() => router.back()} /><Text style={styles.title}>{title}</Text><Text style={styles.copy}>{instruction} Nộp một {photo ? "ảnh" : "video"} thật đúng yêu cầu. Sau khi máy chủ xác nhận tệp hợp lệ, ưu đãi đối tác sẽ được mở khóa.</Text><ErrorBanner message={error} /><View style={styles.action}><Button title={photo ? "Chụp ảnh" : "Quay video"} icon={photo ? "image-outline" : "videocam-outline"} onPress={() => void pick()} loading={saving} /></View></ScreenContainer>;
}
const styles = StyleSheet.create({ title: { color: colors.navy, fontWeight: "800", fontSize: 19 }, copy: { color: colors.textMuted, fontSize: 14, lineHeight: 21 }, action: { marginTop: spacing(2) } });
