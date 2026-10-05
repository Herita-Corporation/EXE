import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as adminApi from "@/api/endpoints/admin";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { colors, spacing } from "@/theme/colors";

export default function CreateManagerScreen() {
  const { t } = useLocale();
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!username.trim() || !email.trim() || !password) {
      setError(t("admin.createManagerFieldsRequired"));
      return;
    }
    setLoading(true);
    try {
      await adminApi.createManager({ username: username.trim(), email: email.trim(), password });
      showToast(t("admin.createManagerSuccess"), "success");
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.createManagerFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("admin.createManager")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Card variant="elevated" style={styles.card}>
        <ErrorBanner message={error} />
        <Input
          label={t("admin.managerUsernameLabel")}
          icon="person-outline"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <Input
          label={t("admin.managerEmailLabel")}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label={t("admin.managerPasswordLabel")}
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button title={t("admin.createManagerButton")} onPress={onSubmit} loading={loading} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700", color: colors.navy },
  card: { marginTop: spacing(1.5), gap: spacing(1.5) },
});
