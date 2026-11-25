import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getPremiumGroup } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PremiumMissionRow } from "@/components/PremiumMissionRow";
import { PremiumAccessGate } from "@/components/PremiumAccessGate";
import { ProgressBar } from "@/components/ProgressBar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";
import type { PremiumGroupDetail } from "@/types/premium";

export default function PremiumGroupDetailScreen() {
  return <PremiumAccessGate><PremiumGroupDetailContent /></PremiumAccessGate>;
}

function PremiumGroupDetailContent() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { t } = useLocale();
  const [group, setGroup] = useState<PremiumGroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPremiumGroup(groupId).then((result) => {
      if (!cancelled) setGroup(result);
    }).catch((err) => {
      if (cancelled) return;
      setGroup(null);
      setError(err instanceof ApiError ? err.message : t("premium.loadFailed"));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [groupId, loadVersion, t]));

  function onBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/mission/premium/groups");
  }

  return (
    <ScreenContainer
      refreshControl={<RefreshControl
        refreshing={loading}
        onRefresh={() => setLoadVersion((version) => version + 1)}
        tintColor={colors.navy}
      />}
    >
      <BackHeader title={group?.provinceName ?? t("premium.groups")} onBack={onBack} />
      <ErrorBanner message={error} />
      {loading ? <ActivityIndicator color={colors.navy} /> : group ? (
        <>
          <Card>
            <View style={styles.groupHeader}>
              <Text style={styles.title}>{t("premium.members")}</Text>
              <Badge label={t("premium.memberCount", { count: group.memberCount })} tone="tint" />
            </View>
            <View style={styles.members}>
              {group.members.map((member) => <Badge key={member.id} label={member.username} />)}
            </View>
            <Text style={styles.progress}>{t("premium.completedCount", { count: group.completedCount, total: group.missions.length })}</Text>
            <Text style={styles.rule}>{t("premium.groupCompletionRule")}</Text>
            <ProgressBar progress={group.completedCount / Math.max(group.missions.length, 1)} color={colors.navy} />
          </Card>
          {group.missions.map((mission) => (
            <PremiumMissionRow key={mission.id} mission={mission} scope="group" scopeId={group.id} />
          ))}
        </>
      ) : (
        <Button title={t("premium.retry")} variant="outline" onPress={() => setLoadVersion((version) => version + 1)} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  groupHeader: { flexDirection: "row", alignItems: "center", gap: spacing(1), justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "700", color: colors.navy },
  members: { flexDirection: "row", flexWrap: "wrap", gap: spacing(0.75) },
  progress: { fontSize: 13, fontWeight: "700", color: colors.navy, marginTop: spacing(0.75) },
  rule: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
});
