import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import axios from "axios";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { useApiConfig } from "@/context/ApiConfigContext";
import { ServiceKey, SERVICE_LABELS } from "@/utils/apiConfigStore";
import { colors, spacing } from "@/theme/colors";

/**
 * Lets the app be pointed at whichever machine is running the .NET
 * services, without a rebuild — required because Expo Go runs on a
 * physical device where `localhost` means the device itself.
 */
export default function SettingsScreen() {
  const { config, defaults, update, reset } = useApiConfig();
  const [draft, setDraft] = useState<Record<ServiceKey, string>>(config);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<
    Record<ServiceKey, "idle" | "checking" | "up" | "down">
  >({ iam: "idle", aiTour: "idle", task: "idle" });

  async function onSave() {
    setSaving(true);
    try {
      await update(draft);
      Alert.alert("Đã lưu", "Địa chỉ API đã được cập nhật.");
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    await reset();
    setDraft(defaults);
  }

  async function onTest(key: ServiceKey) {
    setTestResults((prev) => ({ ...prev, [key]: "checking" }));
    try {
      await axios.get(`${draft[key]}/swagger/v1/swagger.json`, {
        timeout: 5000,
      });
      setTestResults((prev) => ({ ...prev, [key]: "up" }));
    } catch {
      setTestResults((prev) => ({ ...prev, [key]: "down" }));
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing(2.5), gap: spacing(2) }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        Trên điện thoại chạy Expo Go, "localhost" trỏ về chính điện thoại chứ
        không phải máy tính của bạn. Hãy dùng địa chỉ IP LAN của máy tính (Windows:
        chạy `ipconfig`, lấy IPv4 của Wi-Fi) — cả hai thiết bị phải cùng mạng Wi-Fi.
      </Text>

      {(Object.keys(config) as ServiceKey[]).map((key) => (
        <Card key={key}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {SERVICE_LABELS[key]}
            </Text>
            <TestBadge state={testResults[key]} />
          </View>
          <Input
            value={draft[key]}
            onChangeText={(v) => setDraft((prev) => ({ ...prev, [key]: v }))}
            autoCapitalize="none"
            placeholder={defaults[key]}
          />
          <Button
            title="Kiểm tra kết nối"
            variant="ghost"
            onPress={() => onTest(key)}
          />
        </Card>
      ))}

      <Button title="Lưu cấu hình" onPress={onSave} loading={saving} />
      <Button title="Khôi phục mặc định" variant="secondary" onPress={onReset} />
    </ScrollView>
  );
}

function TestBadge({
  state,
}: {
  state: "idle" | "checking" | "up" | "down";
}) {
  if (state === "checking") return <Badge label="Đang kiểm tra" tone="warning" />;
  if (state === "up") return <Badge label="OK" tone="success" />;
  if (state === "down") return <Badge label="Lỗi" tone="danger" />;
  return null;
}
