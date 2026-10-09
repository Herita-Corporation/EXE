import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { OtpInput } from "@/components/OtpInput";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as authApi from "@/api/endpoints/auth";
import { ApiError } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

const RESEND_SECONDS = 60;

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function OtpScreen() {
  const { refreshMe } = useAuth();
  const { t } = useLocale();
  const { email, purpose } = useLocalSearchParams<{
    email?: string;
    purpose?: string;
  }>();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function onVerify() {
    if (code.length < 6 || verifying || !email) return;
    setError(null);
    setVerifying(true);
    try {
      await authApi.verifyEmail({ email, token: code });
      await refreshMe().catch(() => {});
      if (purpose === "register") {
        router.replace("/(tabs)/home");
      } else {
        router.back();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("otp.verifyFailed"));
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    if (resending || seconds > 0 || !email) return;
    setError(null);
    setResending(true);
    try {
      await authApi.resendEmailVerification({ email });
      setSeconds(RESEND_SECONDS);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("otp.resendFailed"));
    } finally {
      setResending(false);
    }
  }

  function onSkip() {
    router.replace("/(tabs)/home");
  }

  return (
    <ScreenContainer>
      <IconButton icon="arrow-back" onPress={() => router.back()} />

      <View style={styles.header}>
        <Text style={styles.title}>{t("otp.title")}</Text>
        <Text style={styles.subtitle}>
          {t("otp.subtitlePrefix")}{" "}
          {email ? <Text style={styles.phone}>{email}</Text> : t("otp.subtitleFallback")}.
        </Text>
      </View>

      <View style={styles.card}>
        <ErrorBanner message={error} />
        <OtpInput value={code} onChange={setCode} length={6} />

        {seconds > 0 ? (
          <Text style={styles.timerText}>
            {t("extra.resendIn")} <Text style={styles.timerValue}>{formatTime(seconds)}</Text>
          </Text>
        ) : null}

        <Button
          title={t("otp.verifyNow")}
          onPress={onVerify}
          loading={verifying}
          disabled={code.length < 6}
        />

        <Pressable onPress={onResend} disabled={seconds > 0 || resending}>
          <Text style={[styles.resendText, (seconds > 0 || resending) && styles.resendDisabled]}>
            {t("otp.resendOtp")}
          </Text>
        </Pressable>

        {purpose === "register" ? (
          <Pressable onPress={onSkip}>
            <Text style={styles.skipText}>{t("otp.skipForNow")}</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={styles.supportRow}
        onPress={() => Linking.openURL("mailto:disatravel.support@gmail.com")}
      >
        <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.support}>{t("otp.havingTrouble")}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing(1), marginTop: spacing(4) },
  title: { fontSize: 24, fontWeight: "700", color: colors.navy, textAlign: "center" },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: spacing(2),
  },
  phone: { color: colors.navy, fontWeight: "700" },
  card: { marginTop: spacing(3), alignItems: "center", gap: spacing(2) },
  timerText: { color: colors.textMuted, fontSize: 13 },
  timerValue: { color: colors.navy, fontWeight: "700" },
  resendText: { color: colors.navy, fontWeight: "600", fontSize: 13 },
  resendDisabled: { color: colors.textMuted },
  skipText: { color: colors.textMuted, fontWeight: "600", fontSize: 13, marginTop: spacing(0.5) },
  supportRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: spacing(3),
  },
  support: { color: colors.textMuted, fontSize: 12 },
});
