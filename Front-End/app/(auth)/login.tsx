import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, isDark, spacing } from "@/theme/colors";

export default function LoginScreen() {
  const { login } = useAuth();
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!username || !password) {
      setError(t("auth.loginFieldsRequired"));
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Image
          source={
            isDark
              ? require("@/assets/images/brand/logo-horizontal-white.png")
              : require("@/assets/images/brand/logo-horizontal.png")
          }
          style={styles.logoImage}
          contentFit="contain"
        />
        <Text style={styles.title}>{t("auth.welcomeBack")}</Text>
        <Text style={styles.subtitle}>
          {t("auth.welcomeBackSubtitle")}
        </Text>
      </View>

      <Card variant="elevated" style={styles.card}>
        <ErrorBanner message={error} />

        {/* Figma's login mockup shows only this one identifier field — but
            IAMService's LoginRequest requires a password too, so it's added
            below (unavoidable given the real auth contract). */}
        <Input
          label={t("auth.usernameOrEmail")}
          icon="mail-outline"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          placeholder={t("auth.usernameOrEmailPlaceholder")}
        />
        <Input
          label={t("auth.password")}
          icon="lock-closed-outline"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
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

        <Link href="/(auth)/forgot-password" style={styles.forgotPasswordLink}>
          {t("auth.forgotPassword")}
        </Link>

        <Button
          title={t("auth.login")}
          onPress={onSubmit}
          loading={loading}
          size="lg"
          icon="arrow-forward"
          iconPosition="right"
        />
      </Card>

      <View style={styles.registerRow}>
        <Text style={{ color: colors.textMuted }}>{t("auth.noAccount")}</Text>
        <Link href="/(auth)/register" style={styles.registerLink}>
          {" "}
          {t("auth.createNewAccount")}
        </Link>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLinks}>
          {t("common.privacyPolicy")}  ·  {t("common.termsOfService")}  ·  {t("auth.support")}
        </Text>
        <Text style={styles.copyright}>{t("auth.copyright")}</Text>
        <Link href="/settings" style={styles.devLink}>
          <Ionicons name="settings-outline" size={12} color={colors.textMuted} /> Cấu hình API
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing(1), marginTop: spacing(4) },
  // Matches brand/logo-horizontal.png's real aspect ratio (1200×180).
  logoImage: { height: 34, aspectRatio: 1200 / 180, marginBottom: spacing(3) },
  title: { fontSize: 26, fontWeight: "800", color: colors.navy, letterSpacing: -0.3 },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: spacing(2),
  },
  card: { marginTop: spacing(2), gap: spacing(2), padding: spacing(2.5) },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginTop: spacing(1),
  },
  registerLink: { color: colors.link, fontWeight: "700" },
  forgotPasswordLink: {
    color: colors.link,
    fontWeight: "600",
    fontSize: 13,
    textAlign: "right",
    marginTop: -spacing(0.5),
  },
  footer: { marginTop: "auto", paddingTop: spacing(4), gap: spacing(0.5) },
  footerLinks: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
  copyright: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  devLink: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing(1),
    fontSize: 12,
  },
});
