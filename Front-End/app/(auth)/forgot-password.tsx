import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as authApi from "@/api/endpoints/auth";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

export default function ForgotPasswordScreen() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // DEV ONLY — no real email provider exists yet, so IAMService hands the
  // reset token straight back in the API response instead of emailing it.
  const [devToken, setDevToken] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!email.trim()) {
      setError(t("forgotPassword.emailRequired"));
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email: email.trim() });
      setSent(true);
      if (typeof res === "object" && res.resetToken) {
        setDevToken(res.resetToken);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("forgotPassword.requestFailed"));
    } finally {
      setLoading(false);
    }
  }

  function onContinue() {
    router.push({
      pathname: "/(auth)/reset-password",
      params: devToken ? { devToken } : undefined,
    });
  }

  return (
    <ScreenContainer>
      <IconButton icon="arrow-back" onPress={() => router.back()} />

      <View style={styles.header}>
        <Text style={styles.title}>{t("forgotPassword.title")}</Text>
        <Text style={styles.subtitle}>{t("forgotPassword.subtitle")}</Text>
      </View>

      <Card variant="elevated" style={styles.card}>
        <ErrorBanner message={error} />

        <Input
          label={t("forgotPassword.emailLabel")}
          icon="mail-outline"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder={t("forgotPassword.emailPlaceholder")}
          editable={!sent}
        />

        {sent ? (
          <>
            <View style={styles.sentBanner}>
              <Text style={styles.sentBannerText}>{t("forgotPassword.checkEmailMessage")}</Text>
            </View>
            {devToken ? (
              <View style={styles.devBanner}>
                <Text style={styles.devBannerText}>
                  Demo — chưa có dịch vụ email thật. Mã đặt lại của bạn là{" "}
                  <Text style={styles.devBannerCode}>{devToken}</Text>
                </Text>
              </View>
            ) : null}
            <Button title={t("forgotPassword.continueToReset")} shape="rounded" onPress={onContinue} />
          </>
        ) : (
          <Button
            title={t("forgotPassword.sendResetLink")}
            shape="rounded"
            onPress={onSubmit}
            loading={loading}
          />
        )}
      </Card>

      <View style={styles.backRow}>
        <Text style={styles.backLink} onPress={() => router.replace("/(auth)/login")}>
          {t("forgotPassword.backToLogin")}
        </Text>
      </View>
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
  sentBanner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: spacing(1.5),
  },
  sentBannerText: { color: colors.text, fontSize: 13, textAlign: "center" },
  devBanner: {
    backgroundColor: colors.goldMuted,
    borderRadius: 12,
    padding: spacing(1.5),
  },
  devBannerText: { color: colors.navyDeep, fontSize: 12, textAlign: "center" },
  devBannerCode: { fontWeight: "800", fontSize: 14 },
  backRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing(2) },
  backLink: { color: colors.navy, fontWeight: "700", fontSize: 13 },
});
