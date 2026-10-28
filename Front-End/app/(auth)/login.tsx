import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LanguageSwitcherButton } from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, isDark, spacing } from "@/theme/colors";

WebBrowser.maybeCompleteAuthSession();

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export default function LoginScreen() {
  const { login, loginWithGoogle } = useAuth();
  const { locale, t } = useLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const handledGoogleToken = useRef<string | null>(null);
  const [googleRequest, googleResponse, promptGoogleLogin] = Google.useIdTokenAuthRequest({
    webClientId: googleWebClientId,
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
    selectAccount: true,
  });
  const googleLabel = locale === "vi" ? "Tiếp tục với Google" : "Continue with Google";
  const googleNotConfigured = locale === "vi"
    ? "Đăng nhập Google chưa được cấu hình cho bản build này."
    : "Google sign-in has not been configured for this build.";

  useEffect(() => {
    if (googleResponse?.type !== "success") return;

    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      setGoogleLoading(false);
      setError(t("auth.loginFailed"));
      return;
    }
    if (handledGoogleToken.current === idToken) return;
    handledGoogleToken.current = idToken;

    void (async () => {
      try {
        await loginWithGoogle(idToken);
        router.replace("/(tabs)/home");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t("auth.loginFailed"));
      } finally {
        setGoogleLoading(false);
      }
    })();
  }, [googleResponse, loginWithGoogle, t]);

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

  async function onGoogleSubmit() {
    setError(null);
    if (!googleWebClientId || !googleAndroidClientId) {
      setError(googleNotConfigured);
      return;
    }

    setGoogleLoading(true);
    try {
      const result = await promptGoogleLogin();
      if (result.type !== "success") setGoogleLoading(false);
    } catch {
      setGoogleLoading(false);
      setError(t("auth.loginFailed"));
    }
  }

  return (
    <ScreenContainer>
      <LanguageSwitcherButton style={styles.languageSwitcher} />
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
          autoComplete="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          value={username}
          onChangeText={setUsername}
          placeholder={t("auth.usernameOrEmailPlaceholder")}
        />
        <Input
          label={t("auth.password")}
          ref={passwordRef}
          icon="lock-closed-outline"
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{locale === "vi" ? "hoặc" : "or"}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title={googleLabel}
          onPress={onGoogleSubmit}
          loading={googleLoading}
          disabled={!googleRequest || loading}
          variant="outline"
          size="lg"
          icon="logo-google"
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
          <Text onPress={() => Linking.openURL("https://disatravel.id.vn/privacy")}>
            {t("common.privacyPolicy")}
          </Text>
          {"  ·  "}
          <Text onPress={() => Linking.openURL("https://disatravel.id.vn/terms")}>
            {t("common.termsOfService")}
          </Text>
          {"  ·  "}
          <Text onPress={() => Linking.openURL("mailto:disatravel.support@gmail.com")}>
            {t("auth.support")}
          </Text>
        </Text>
        <Text style={styles.copyright}>{t("auth.copyright")}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  languageSwitcher: { marginTop: spacing(1.5) },
  header: { alignItems: "center", gap: spacing(1), marginTop: spacing(2) },
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
  divider: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 12, textTransform: "uppercase" },
  footer: { marginTop: "auto", paddingTop: spacing(4), gap: spacing(0.5) },
  footerLinks: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
  copyright: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
});
