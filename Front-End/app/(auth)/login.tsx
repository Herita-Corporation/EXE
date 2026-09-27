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
import { colors, radius, spacing } from "@/theme/colors";

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
        <View style={styles.logoBadge}>
          <Image source={require("@/assets/images/disa-logo-white.png")} style={styles.logoImage} contentFit="contain" />
        </View>
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
        <View style={styles.footerLinks}>
          <Text style={styles.footerLink}>{t("common.privacyPolicy")}</Text>
          <Text style={styles.footerLink}>{t("common.termsOfService")}</Text>
          <Text style={styles.footerLink}>{t("auth.support")}</Text>
        </View>
        <Text style={styles.copyright}>{t("auth.copyright")}</Text>
        <Link href="/settings" style={styles.devLink}>
          ⚙ Cấu hình địa chỉ API (dùng cho Expo Go)
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing(1), marginTop: spacing(2) },
  logoBadge: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    marginBottom: spacing(0.5),
  },
  // Matches the logo asset's real aspect ratio (740×403), same as Home's header.
  logoImage: { height: 32, aspectRatio: 740 / 403 },
  title: { fontSize: 24, fontWeight: "700", color: colors.navy },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: spacing(2),
  },
  card: { marginTop: spacing(2), gap: spacing(1.5) },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginTop: spacing(1),
  },
  registerLink: { color: colors.navy, fontWeight: "700" },
  forgotPasswordLink: {
    color: colors.navy,
    fontWeight: "600",
    fontSize: 13,
    textAlign: "right",
    marginTop: -spacing(0.5),
  },
  footer: { marginTop: spacing(3), gap: spacing(0.5) },
  footerLinks: { flexDirection: "row", justifyContent: "center", gap: spacing(2) },
  footerLink: { color: colors.textMuted, fontSize: 12 },
  copyright: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  devLink: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing(1),
    fontSize: 12,
  },
});
