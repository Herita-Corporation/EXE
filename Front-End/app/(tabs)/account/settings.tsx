import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Toggle } from "@/components/Toggle";
import { SettingsRow } from "@/components/SettingsRow";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import * as authApi from "@/api/endpoints/auth";
import { ApiError } from "@/api/http";
import { enablePushNotifications } from "@/utils/pushNotifications";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

export default function AccountSettingsScreen() {
  const { user, refreshMe } = useAuth();
  const { t, locale, setLocale } = useLocale();
  // Email/Location/Biometric remain cosmetic/local-only — no backend for
  // those exists. Push is wired to the real Expo push token registration
  // (see onTogglePush below).
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const [editingField, setEditingField] = useState<"email" | "phone" | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingField, setSavingField] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  function stub(feature: string) {
    Alert.alert(feature, "Tính năng này chưa được hỗ trợ.");
  }

  async function onTogglePush(next: boolean) {
    if (!next) {
      // No unregister endpoint — just stop showing it as enabled locally.
      setPushEnabled(false);
      return;
    }
    const enabled = await enablePushNotifications();
    setPushEnabled(enabled);
    if (!enabled) {
      Alert.alert(t("settings.error"), t("settings.pushNotificationsFailed"));
    }
  }

  function onSelectLanguage() {
    Alert.alert(t("settings.selectLanguage"), undefined, [
      { text: t("settings.languageEnglish"), onPress: () => setLocale("en") },
      { text: t("settings.languageVietnamese"), onPress: () => setLocale("vi") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  async function onVerifyEmail() {
    setVerifyingEmail(true);
    try {
      const res = await authApi.sendEmailVerification();
      Alert.alert(
        t("settings.confirmEmailSentTitle"),
        t("settings.confirmEmailSentBody", { code: res.verificationToken }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("settings.confirm"),
            onPress: async () => {
              try {
                await authApi.verifyEmail({ token: res.verificationToken });
                await refreshMe();
                Alert.alert(t("settings.success"), t("settings.emailVerifiedMessage"));
              } catch (err) {
                Alert.alert(t("settings.error"), err instanceof ApiError ? err.message : t("settings.emailVerifyFailed"));
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert(t("settings.error"), err instanceof ApiError ? err.message : t("settings.sendEmailVerificationFailed"));
    } finally {
      setVerifyingEmail(false);
    }
  }

  async function onVerifyPhone() {
    if (!user?.phoneNumber) return;
    setVerifyingPhone(true);
    try {
      const res = await authApi.resendPhoneOtp({ phoneNumber: user.phoneNumber });
      router.push({
        pathname: "/(auth)/otp",
        params: { phoneNumber: user.phoneNumber, devOtpCode: res.otpCode, purpose: "settings" },
      });
    } catch (err) {
      Alert.alert(t("settings.error"), err instanceof ApiError ? err.message : t("settings.sendOtpFailed"));
    } finally {
      setVerifyingPhone(false);
    }
  }

  async function onSaveEmail() {
    if (!newEmail.trim()) return;
    setSavingField(true);
    try {
      await authApi.changeEmail({ newEmail: newEmail.trim() });
      await refreshMe();
      setEditingField(null);
      Alert.alert(t("settings.success"), t("settings.emailUpdatedMessage"));
    } catch (err) {
      Alert.alert(t("settings.error"), err instanceof ApiError ? err.message : t("settings.changeEmailFailed"));
    } finally {
      setSavingField(false);
    }
  }

  async function onSavePhone() {
    if (!newPhone.trim()) return;
    setSavingField(true);
    try {
      const res = await authApi.changePhone({ newPhoneNumber: newPhone.trim() });
      await refreshMe();
      setEditingField(null);
      router.push({
        pathname: "/(auth)/otp",
        params: { phoneNumber: res.phoneNumber, devOtpCode: res.otpCode, purpose: "settings" },
      });
    } catch (err) {
      Alert.alert(t("settings.error"), err instanceof ApiError ? err.message : t("settings.changePhoneFailed"));
    } finally {
      setSavingField(false);
    }
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("settings.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.sectionLabel}>{t("settings.verification")}</Text>
      <Card style={styles.sectionCard}>
        <SettingsRow
          icon="mail-outline"
          label={t("settings.email")}
          description={user?.email}
          onPress={() => {
            setEditingField(editingField === "email" ? null : "email");
            setNewEmail(user?.email ?? "");
          }}
          right={
            user?.isEmailVerified ? (
              <Badge label={t("settings.verified")} tone="success" />
            ) : (
              <Pressable onPress={onVerifyEmail} hitSlop={8} disabled={verifyingEmail}>
                <Text style={styles.verifyLink}>{verifyingEmail ? "..." : t("settings.verify")}</Text>
              </Pressable>
            )
          }
        />
        {editingField === "email" ? (
          <View style={styles.editRow}>
            <Input
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t("settings.emailPlaceholder")}
            />
            <View style={styles.editButtonsRow}>
              <Button title={t("common.cancel")} variant="ghost" size="sm" onPress={() => setEditingField(null)} />
              <Button title={t("common.save")} size="sm" loading={savingField} onPress={onSaveEmail} />
            </View>
          </View>
        ) : null}

        <View style={styles.divider} />

        <SettingsRow
          icon="call-outline"
          label={t("settings.phoneNumber")}
          description={user?.phoneNumber ?? t("settings.noPhoneNumber")}
          onPress={() => {
            setEditingField(editingField === "phone" ? null : "phone");
            setNewPhone(user?.phoneNumber ?? "");
          }}
          right={
            user?.isPhoneVerified ? (
              <Badge label={t("settings.verified")} tone="success" />
            ) : (
              <Pressable onPress={onVerifyPhone} hitSlop={8} disabled={verifyingPhone}>
                <Text style={styles.verifyLink}>{verifyingPhone ? "..." : t("settings.verify")}</Text>
              </Pressable>
            )
          }
        />
        {editingField === "phone" ? (
          <View style={styles.editRow}>
            <Input
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              placeholder={t("settings.phonePlaceholder")}
            />
            <View style={styles.editButtonsRow}>
              <Button title={t("common.cancel")} variant="ghost" size="sm" onPress={() => setEditingField(null)} />
              <Button title={t("common.save")} size="sm" loading={savingField} onPress={onSavePhone} />
            </View>
          </View>
        ) : null}
      </Card>

      <Text style={styles.sectionLabel}>{t("settings.general")}</Text>
      <Card style={styles.sectionCard}>
        <SettingsRow
          icon="globe-outline"
          label={t("settings.language")}
          description={locale === "en" ? t("settings.languageEnglish") : t("settings.languageVietnamese")}
          onPress={onSelectLanguage}
        />
        <View style={styles.divider} />
        <SettingsRow
          icon="cash-outline"
          label={t("settings.currency")}
          description="USD"
          onPress={() => stub(t("settings.currency"))}
        />
        <View style={styles.divider} />
        <SettingsRow
          icon="moon-outline"
          label={t("settings.theme")}
          description={t("settings.themeComingSoon")}
          right={<View />}
        />
      </Card>

      <Text style={styles.sectionLabel}>{t("settings.notifications")}</Text>
      <Card style={styles.sectionCard}>
        <Toggle
          label={t("settings.pushNotifications")}
          description={t("settings.pushNotificationsDesc")}
          value={pushEnabled}
          onValueChange={onTogglePush}
        />
        <View style={styles.divider} />
        <Toggle
          label={t("settings.emailUpdates")}
          description={t("settings.emailUpdatesDesc")}
          value={emailEnabled}
          onValueChange={setEmailEnabled}
        />
      </Card>

      <Text style={styles.sectionLabel}>{t("settings.privacySecurity")}</Text>
      <Card style={styles.sectionCard}>
        <Toggle
          label={t("settings.locationServices")}
          description={t("settings.locationServicesDesc")}
          value={locationEnabled}
          onValueChange={setLocationEnabled}
        />
        <View style={styles.divider} />
        <Toggle
          label={t("settings.biometricLogin")}
          description={t("settings.biometricLoginDesc")}
          value={biometricEnabled}
          onValueChange={setBiometricEnabled}
        />
      </Card>

      <Text style={styles.sectionLabel}>{t("settings.about")}</Text>
      <Card style={styles.sectionCard}>
        <SettingsRow
          icon="information-circle-outline"
          label={t("settings.version")}
          description={Constants.expoConfig?.version ?? "1.0.0"}
          right={<View />}
        />
        <View style={styles.divider} />
        <SettingsRow
          icon="document-text-outline"
          label={t("settings.termsOfService")}
          onPress={() => router.push("/(tabs)/account/terms")}
        />
        <View style={styles.divider} />
        <SettingsRow
          icon="shield-outline"
          label={t("settings.privacyPolicy")}
          onPress={() => router.push("/(tabs)/account/privacy")}
        />
      </Card>

      <Text style={styles.sectionLabel}>{t("settings.developer")}</Text>
      <Card style={styles.sectionCard}>
        <SettingsRow
          icon="construct-outline"
          label="Cấu hình địa chỉ API (Expo Go)"
          onPress={() => router.push("/settings")}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700", color: colors.navy },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing(1),
  },
  sectionCard: { gap: 0 },
  divider: { height: 1, backgroundColor: colors.border },
  verifyLink: { color: colors.navy, fontWeight: "700", fontSize: 13 },
  editRow: { gap: spacing(1), paddingBottom: spacing(1.25) },
  editButtonsRow: { flexDirection: "row", justifyContent: "flex-end", gap: spacing(1) },
});
