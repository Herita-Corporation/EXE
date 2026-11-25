import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { createPremiumGroup, getPremiumGroups, getPremiumProvinces } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Input } from "@/components/Input";
import { PartnerRecommendations } from "@/components/PartnerRecommendations";
import { PremiumAccessGate } from "@/components/PremiumAccessGate";
import { PremiumProvincePicker } from "@/components/PremiumProvincePicker";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";
import type { PremiumGroup, PremiumProvince } from "@/types/premium";

function openGroup(groupId: string) {
  router.push({ pathname: "/(tabs)/mission/premium/group/[groupId]", params: { groupId } });
}

const INITIAL_ACCOUNT_FIELDS = 19;
// The backend API represents totals as signed 32-bit integers.
const MAX_MEMBER_COUNT = 2_147_483_647;

export default function PremiumGroupsScreen() {
  return <PremiumAccessGate><PremiumGroupsContent /></PremiumAccessGate>;
}

function PremiumGroupsContent() {
  const { t } = useLocale();
  const [groups, setGroups] = useState<PremiumGroup[]>([]);
  const [provinces, setProvinces] = useState<PremiumProvince[]>([]);
  const [province, setProvince] = useState<PremiumProvince>();
  const [countInput, setCountInput] = useState("2");
  const [accounts, setAccounts] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const busy = useRef(false);
  const memberCount = Number(countInput);
  const validCount = /^\d+$/.test(countInput) && memberCount >= 2 && memberCount <= MAX_MEMBER_COUNT;
  const visibleCount = validCount ? Math.min(memberCount - 1, Math.max(INITIAL_ACCOUNT_FIELDS, accounts.length + 1)) : 0;
  const memberAccounts = Array.from({ length: visibleCount }, (_, index) => accounts[index]?.trim() ?? "");
  const canCreate = !!province && validCount && visibleCount === memberCount - 1 && memberAccounts.every(Boolean);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getPremiumGroups(), getPremiumProvinces()]).then(([groupList, provinceList]) => {
      if (cancelled) return;
      setGroups(groupList);
      setProvinces(provinceList);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof ApiError ? err.message : t("premium.loadFailed"));
      setGroups([]);
      setProvinces([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadVersion, t]));

  async function onCreate() {
    if (!canCreate || !province || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const group = await createPremiumGroup(province.id, memberCount, memberAccounts);
      setGroups((previous) => [group, ...previous]);
      setEditing(false);
      setProvince(undefined);
      setCountInput("2");
      setAccounts([]);
      openGroup(group.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("premium.createGroupFailed"));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function onBack() {
    if (busy.current) return;
    if (editing) {
      setEditing(false);
      setError(null);
    } else {
      router.navigate("/(tabs)/missions");
    }
  }

  return (
    <ScreenContainer>
      <BackHeader title={t(editing ? "premium.createGroup" : "premium.groups")} onBack={onBack} />
      <Text style={styles.body}>{t("premium.groupBenefit")}</Text>
      <ErrorBanner message={error} />
      {loading ? <ActivityIndicator color={colors.navy} /> : provinces.length === 0 ? (
        <Button title={t("premium.retry")} variant="outline" onPress={() => setLoadVersion((version) => version + 1)} />
      ) : editing ? (
        <>
          <PremiumProvincePicker provinces={provinces} selected={province} onSelect={setProvince} />
          {province && <PartnerRecommendations destinations={[province.name]} />}
          <Card style={styles.form}>
            <Input
              label={t("premium.groupSize")}
              accessibilityLabel={t("premium.groupSize")}
              keyboardType="number-pad"
              maxLength={10}
              value={countInput}
              onChangeText={setCountInput}
              error={validCount ? null : t("premium.groupSizeHint")}
              editable={!saving}
            />
            <Text style={styles.body}>{t("premium.eligibleMembers")}</Text>
            {memberAccounts.map((_, index) => {
              const label = t("premium.memberAccount", { count: index + 2 });
              return (
                <Input
                  key={index}
                  label={label}
                  accessibilityLabel={label}
                  placeholder={t("premium.accountPlaceholder")}
                  value={accounts[index] ?? ""}
                  onChangeText={(value) => setAccounts((previous) => {
                    const next = [...previous];
                    next[index] = value;
                    return next;
                  })}
                  icon="person-outline"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!saving}
                />
              );
            })}
          </Card>
          <Button title={t("premium.createGroup")} onPress={onCreate} disabled={!canCreate} loading={saving} icon="people-outline" />
        </>
      ) : (
        <>
          <Button title={t("premium.createGroup")} onPress={() => setEditing(true)} icon="add" />
          {groups.length === 0 && <EmptyState icon="people-outline" title={t("premium.noGroups")} />}
          {groups.map((group) => (
            <Pressable
              key={group.id}
              onPress={() => openGroup(group.id)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.group, pressed && styles.pressed]}
            >
              <View style={styles.icon}><Ionicons name="people-outline" size={23} color={colors.navy} /></View>
              <View style={styles.heading}>
                <Text style={styles.title}>{group.provinceName}</Text>
                <Text style={styles.body} numberOfLines={1}>{group.members.map((member) => member.username).join(", ")}</Text>
                <Text style={styles.body}>
                  {t("premium.memberCount", { count: group.memberCount })} · {t("premium.groupProgress", { count: group.completedCount })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing(1.5) },
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.25),
    padding: spacing(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, gap: spacing(0.4) },
  title: { fontSize: 16, fontWeight: "700", color: colors.navy },
  body: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  pressed: { opacity: 0.72 },
});
