import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as authApi from "@/api/endpoints/auth";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { colors, spacing } from "@/theme/colors";

export default function ResetPasswordScreen() {
  const { t } = useLocale();
  const { showToast } = useToast();
  const { devToken } = useLocalSearchParams<{ devToken?: string }>();
  const [token, setToken] = useState(devToken ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!token.trim() || !newPassword || !confirmPassword) {
      setError(t("resetPassword.fieldsRequired"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("resetPassword.passwordsDontMatch"));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token: token.trim(), newPassword });
      showToast(t("resetPassword.resetSuccessMessage"), "success");
      router.replace("/(auth)/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("resetPassword.resetFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <IconButton icon="arrow-back" onPress={() => router.back()} />

      <View style={styles.header}>
        <Text style={styles.title}>{t("resetPassword.title")}</Text>
        <Text style={styles.subtitle}>{t("resetPassword.subtitle")}</Text>
      </View>

      <Card variant="elevated" style={styles.card}>
        <ErrorBanner message={error} />

        <Input
          label={t("resetPassword.tokenLabel")}
          icon="key-outline"
          autoCapitalize="none"
          value={token}
          onChangeText={setToken}
          placeholder={t("resetPassword.tokenPlaceholder")}
        />
        <Input
          label={t("resetPassword.newPasswordLabel")}
          icon="lock-closed-outline"
          secureTextEntry={!showPassword}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          rightElement={
            <Pressable onPress={() => setShowPassword((s) => !s)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          }
        />
        <Input
          label={t("resetPassword.confirmPasswordLabel")}
          icon="lock-closed-outline"
          secureTextEntry={!showPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
        />

        <Button title={t("resetPassword.resetButton")} onPress={onSubmit} loading={loading} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing(1), marginTop: spacing(2) },
  title: { fontSize: 24, fontWeight: "700", color: colors.navy, textAlign: "center" },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: spacing(2),
  },
  card: { marginTop: spacing(3), gap: spacing(1.5) },
});
