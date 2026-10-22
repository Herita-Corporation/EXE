import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SettingsRow } from "@/components/SettingsRow";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { changePassword, uploadAvatar } from "@/api/endpoints/auth";
import { ApiError } from "@/api/http";
import { getItineraryHistory } from "@/utils/itineraryHistory";
import { useGamification } from "@/hooks/useGamification";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, shadow, spacing } from "@/theme/colors";

export default function AccountScreen() {
  const { user, logout, refreshMe } = useAuth();
  const { showToast } = useToast();
  const gamification = useGamification();
  const { t } = useLocale();
  const [tripCount, setTripCount] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) getItineraryHistory(user.id).then((h) => setTripCount(h.length));
    }, [user])
  );

  const displayName = user?.username ?? t("common.voyager");

  async function onChangePassword() {
    setPwError(null);
    setPwSuccess(null);
    if (!oldPassword || !newPassword) {
      setPwError(t("account.passwordFieldsRequired"));
      return;
    }
    setChanging(true);
    try {
      const msg = await changePassword({ oldPassword, newPassword });
      setPwSuccess(msg || t("account.passwordChangeSuccess"));
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : t("account.passwordChangeFailed"));
    } finally {
      setChanging(false);
    }
  }

  function confirmLogout() {
    Alert.alert(t("extra.logoutConfirmTitle"), t("extra.logoutConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("account.logout"), style: "destructive", onPress: onLogout },
    ]);
  }

  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      router.replace("/(auth)/login");
    }
  }

  async function onChangeAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast(t("memories.library"), "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      await uploadAvatar(result.assets[0].uri);
      await refreshMe();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("account.avatarUploadFailed"), "error");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <ScreenContainer avoidTabBar>
      <ScreenHeader title={t("account.myAccount")} />

      <View style={styles.profileCard}>
        <View style={styles.avatarSection}>
        <View>
          <Avatar source={user?.avatarUrl} name={displayName} size={90} />
          <Pressable style={styles.avatarEditBadge} onPress={onChangeAvatar} disabled={uploadingAvatar}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="pencil" size={12} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
        </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{tripCount}</Text>
          <Text style={styles.statLabel}>{t("account.trips")}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{gamification.points.toLocaleString()}</Text>
          <Text style={styles.statLabel}>{t("account.points")}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{gamification.level}</Text>
          <Text style={styles.statLabel}>{t("account.level")}</Text>
        </View>
      </View>
      </View>

      <Text style={styles.sectionLabel}>{t("account.personalInfo")}</Text>
      <Card style={styles.sectionCard}>
        <SettingsRow
          icon="lock-closed-outline"
          label={t("extra.changePassword")}
          onPress={() => setShowProfileDetails((s) => !s)}
          right={
            <Ionicons
              name={showProfileDetails ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textMuted}
            />
          }
        />
        {showProfileDetails ? (
          <View style={styles.passwordForm}>
            <ErrorBanner message={pwError} />
            {pwSuccess ? <Text style={{ color: colors.success, fontSize: 12 }}>{pwSuccess}</Text> : null}
            <Input
              label={t("account.oldPassword")}
              icon="lock-closed-outline"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <Input
              label={t("account.newPassword")}
              icon="lock-closed-outline"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <Button title={t("account.updatePassword")} size="sm" onPress={onChangePassword} loading={changing} />
          </View>
        ) : null}
      </Card>

      <Text style={styles.sectionLabel}>{t("account.travelHistory")}</Text>
      <Card style={styles.sectionCard}>
        <SettingsRow
          icon="sparkles-outline"
          label={t("account.myMemories")}
          onPress={() => router.push("/(tabs)/mission/collection")}
        />
      </Card>

      <Text style={styles.sectionLabel}>{t("account.appSettings")}</Text>
      <Card style={styles.sectionCard}>
        <SettingsRow
          icon="settings-outline"
          label={t("account.settings")}
          onPress={() => router.push("/(tabs)/account/settings")}
        />
        <View style={styles.rowDivider} />
        <SettingsRow icon="help-circle-outline" label={t("account.helpSupport")} onPress={() => Linking.openURL("mailto:disatravel.support@gmail.com")} />
      </Card>

      <Text style={styles.sectionLabel}>{t("account.dangerZone")}</Text>
      <Card style={styles.sectionCard}>
        <SettingsRow
          icon="log-out-outline"
          label={t("account.logout")}
          danger
          onPress={confirmLogout}
          right={loggingOut ? <ActivityIndicator color={colors.danger} /> : <View />}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing(2.5),
    gap: spacing(2),
    ...shadow,
  },
  avatarSection: { alignItems: "center", gap: spacing(0.5) },
  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  name: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: spacing(0.5) },
  email: { fontSize: 12, color: colors.textMuted },
  statsRow: { flexDirection: "row", gap: spacing(1) },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    backgroundColor: colors.blueSoft,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.navy },
  statLabel: { fontSize: 11, color: colors.textMuted },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing(1),
  },
  sectionCard: { gap: 0, paddingVertical: spacing(0.5) },
  rowDivider: { height: 1, backgroundColor: colors.border },
  passwordForm: { gap: spacing(1), paddingBottom: spacing(1) },
});
