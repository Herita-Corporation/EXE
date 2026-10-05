import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { LanguagePickerModal } from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";
import * as authApi from "@/api/endpoints/auth";
import { ApiError } from "@/api/http";
import { enablePushNotifications } from "@/utils/pushNotifications";
import { useLocale } from "@/i18n/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { colors, spacing } from "@/theme/colors";

export default function AccountSettingsScreen() {
  const { user, refreshMe } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { showToast } = useToast();
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
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);

  function stub(feature: string) {
    showToast(`${feature}: Tính năng này chưa được hỗ trợ.`, "info");
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
      showToast(t("settings.pushNotificationsFailed"), "error");
    }
  }

  function onSelectLanguage() {
    setLanguagePickerOpen(true);
  }

  async function onVerifyEmail() {
    setVerifyingEmail(true);
    try {
      const res = await authApi.sendEmailVerification();
      router.push({
        pathname: "/(auth)/otp",
        params: { email: res.email, purpose: "settings" },
      });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("settings.sendEmailVerificationFailed"), "error");
    } finally {
      setVerifyingEmail(false);
    }
  }

  async function onSaveEmail() {
    if (!newEmail.trim()) return;
    setSavingField(true);
    try {
      await authApi.changeEmail({ newEmail: newEmail.trim() });
      await refreshMe();
      setEditingField(null);
      showToast(t("settings.emailUpdatedMessage"), "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("settings.changeEmailFailed"), "error");
    } finally {
      setSavingField(false);
    }
  }

  async function onSavePhone() {
    if (!newPhone.trim()) return;
    setSavingField(true);
    try {
      await authApi.changePhone({ newPhoneNumber: newPhone.trim() });
      await refreshMe();
      setEditingField(null);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("settings.changePhoneFailed"), "error");
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

      <LanguagePickerModal
        visible={languagePickerOpen}
        onClose={() => setLanguagePickerOpen(false)}
      />
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
