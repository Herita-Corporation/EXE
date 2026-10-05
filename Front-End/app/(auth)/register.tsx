import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LanguageSwitcherButton } from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

export default function RegisterScreen() {
  const { register, login } = useAuth();
  const { t } = useLocale();
  // Full Name is collected for Figma fidelity but NOT sent — IAMService's
  // RegisterRequest has no matching column today.
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSuccess(null);
    if (!fullName || !username || !phone || !email || !password || !confirm) {
      setError(t("auth.registerFieldsRequired"));
      return;
    }
    // Confirm-password is validated client-side only — never sent to the API.
    if (password !== confirm) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }
    if (!agreed) {
      setError(t("auth.mustAgreeToTerms"));
      return;
    }
    setLoading(true);
    try {
      const res = await register(username.trim(), email.trim(), password, phone.trim());
      setSuccess(t("auth.registerSuccessLoggingIn"));
      await login(username.trim(), password);
      router.replace({
        pathname: "/(auth)/otp",
        params: { email: res.email, purpose: "register" },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <LanguageSwitcherButton style={styles.languageSwitcher} />
      <Text style={styles.wordmark}>DISA Travel</Text>

      <Card variant="elevated" style={styles.card}>
        <Text style={styles.title}>{t("auth.createAccount")}</Text>
        <Text style={styles.subtitle}>{t("auth.createAccountSubtitle")}</Text>

        <ErrorBanner message={error} />
        {success ? <Text style={{ color: colors.success }}>{success}</Text> : null}

        <Input
          label={t("auth.fullName")}
          icon="person-outline"
          value={fullName}
          onChangeText={setFullName}
          placeholder={t("auth.fullNamePlaceholder")}
        />
        <Input
          label={t("auth.username")}
          icon="at-outline"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          placeholder={t("auth.usernamePlaceholder")}
        />
        <Input
          label={t("auth.phoneNumber")}
          icon="call-outline"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          placeholder={t("auth.phoneNumberPlaceholder")}
        />
        <Input
          label={t("auth.emailAddress")}
          icon="mail-outline"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder={t("auth.emailAddressPlaceholder")}
        />
        <Input
          label={t("auth.password")}
          icon="lock-closed-outline"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
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
          label={t("auth.confirmPassword")}
          icon="shield-checkmark-outline"
          secureTextEntry={!showPassword}
          value={confirm}
          onChangeText={setConfirm}
        />

        <Pressable style={styles.tosRow} onPress={() => setAgreed((a) => !a)}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed ? <Ionicons name="checkmark" size={14} color={colors.primaryText} /> : null}
          </View>
          <Text style={styles.tosText}>
            {t("auth.agreeToThe")}
            <Text
              style={styles.tosLink}
              onPress={() => Linking.openURL("https://disatravel.id.vn/terms")}
            >
              {t("common.termsOfService")}
            </Text>
            {t("auth.and")}
            <Text
              style={styles.tosLink}
              onPress={() => Linking.openURL("https://disatravel.id.vn/privacy")}
            >
              {t("common.privacyPolicy")}
            </Text>
            .
          </Text>
        </Pressable>

        <Button
          title={t("auth.register")}
          onPress={onSubmit}
          loading={loading}
          icon="arrow-forward"
          iconPosition="right"
        />

        <View style={styles.divider} />

        <View style={styles.loginRow}>
          <Text style={{ color: colors.textMuted }}>{t("auth.alreadyHaveAccount")}</Text>
          <Link href="/(auth)/login" style={styles.loginLink}>
            {" "}
            {t("auth.login")}
          </Link>
        </View>
      </Card>

      <Text style={styles.copyright}>
        {t("auth.registerCopyright")}
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  languageSwitcher: { marginTop: spacing(1.5) },
  wordmark: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.navy,
    textAlign: "center",
    marginTop: spacing(2),
  },
  card: { marginTop: spacing(2), gap: spacing(1.25) },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 13, marginBottom: spacing(0.5) },
  tosRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing(1) },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tosText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  tosLink: { color: colors.navy, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(0.5) },
  loginRow: { flexDirection: "row", justifyContent: "center" },
  loginLink: { color: colors.navy, fontWeight: "700" },
  copyright: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing(2),
    marginBottom: spacing(2),
  },
});
