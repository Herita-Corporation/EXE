import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  const { phoneNumber, devOtpCode, purpose } = useLocalSearchParams<{
    phoneNumber?: string;
    devOtpCode?: string;
    purpose?: string;
  }>();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEV ONLY — no real SMS provider exists yet, so IAMService hands the code
  // straight back in the API response instead of texting it. Shown here so
  // the flow stays fully testable; remove once a real SMS gateway is wired up.
  const [devCode, setDevCode] = useState(devOtpCode ?? null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function onVerify() {
    if (code.length < 6 || verifying || !phoneNumber) return;
    setError(null);
    setVerifying(true);
    try {
      await authApi.verifyPhoneOtp({ phoneNumber, code });
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
    if (resending || seconds > 0 || !phoneNumber) return;
    setError(null);
    setResending(true);
    try {
      const res = await authApi.resendPhoneOtp({ phoneNumber });
      setDevCode(res.otpCode);
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
          {phoneNumber ? <Text style={styles.phone}>{phoneNumber}</Text> : t("otp.subtitleFallback")}.
        </Text>
      </View>

      {devCode ? (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>
            Demo — chưa có dịch vụ SMS thật. Mã xác thực của bạn là{" "}
            <Text style={styles.devBannerCode}>{devCode}</Text>
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <ErrorBanner message={error} />
        <OtpInput value={code} onChange={setCode} length={6} />

        <Text style={styles.timerText}>
          {t("otp.codeExpiresIn")} <Text style={styles.timerValue}>{formatTime(seconds)}</Text>
        </Text>

        <Button
          title={t("otp.verifyNow")}
          shape="rounded"
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

      <View style={styles.supportRow}>
        <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.support}>{t("otp.havingTrouble")}</Text>
      </View>
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
  devBanner: {
    backgroundColor: colors.goldMuted,
    borderRadius: 12,
    padding: spacing(1.5),
    marginTop: spacing(2),
    marginHorizontal: spacing(0.5),
  },
  devBannerText: { color: colors.navyDeep, fontSize: 12, textAlign: "center" },
  devBannerCode: { fontWeight: "800", fontSize: 14 },
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
