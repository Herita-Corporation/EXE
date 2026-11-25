import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { acceptSpecialMissions, getPremiumProvinces, getSpecialMissions } from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PartnerRecommendations } from "@/components/PartnerRecommendations";
import { PremiumAccessGate } from "@/components/PremiumAccessGate";
import { PremiumMissionRow } from "@/components/PremiumMissionRow";
import { PremiumProvincePicker } from "@/components/PremiumProvincePicker";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useLocale } from "@/i18n/LocaleContext";
import { colors } from "@/theme/colors";
import type { PremiumMission, PremiumProvince } from "@/types/premium";

export default function SpecialMissionsScreen() {
  return <PremiumAccessGate from="special"><SpecialMissionsContent /></PremiumAccessGate>;
}

function SpecialMissionsContent() {
  const { t } = useLocale();
  const [provinces, setProvinces] = useState<PremiumProvince[]>([]);
  const [province, setProvince] = useState<PremiumProvince>();
  const [missions, setMissions] = useState<PremiumMission[]>([]);
  const [selected, setSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const busy = useRef(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = province
      ? getSpecialMissions(province.id).then((list) => { if (!cancelled) setMissions(list); })
      : getPremiumProvinces().then((list) => { if (!cancelled) setProvinces(list); });
    load.catch((err) => {
      if (!cancelled) {
        setError(err instanceof ApiError ? err.message : t("premium.loadFailed"));
        setMissions([]);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [province, loadVersion, t]));

  async function acceptAll() {
    if (!province || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      setMissions(await acceptSpecialMissions(province.id));
      setSelected(false);
      router.push({
        pathname: "/(tabs)/mission/create",
        params: { missionProvinceId: province.id },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("premium.acceptFailed"));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const acceptedCount = missions.filter((mission) => mission.accepted).length;
  const total = missions.length;

  return (
    <ScreenContainer>
      <BackHeader title={t("premium.special")} onBack={() => router.navigate("/(tabs)/missions")} />
      <Text style={styles.guide}>{t("premium.specialGuide")}</Text>
      {!!provinces.length && (
        <PremiumProvincePicker
          provinces={provinces}
          selected={province}
          onSelect={(next) => {
            if (busy.current || next.id === province?.id) return;
            setMissions([]);
            setSelected(false);
            setProvince(next);
          }}
        />
      )}
      {province && <PartnerRecommendations destinations={[province.name]} />}
      <ErrorBanner message={error} />
      {loading ? <ActivityIndicator color={colors.navy} /> : (
        <>
          {error && total === 0 && (
            <Button title={t("premium.retry")} variant="outline" onPress={() => setLoadVersion((version) => version + 1)} />
          )}
          {province && total > 0 && (
            <>
              <Card>
                <Text style={styles.count}>{t("premium.acceptedCount", { count: acceptedCount, total })}</Text>
                <Text style={styles.guide}>{t("premium.noMissionPoints")}</Text>
                <Button
                  title={t("premium.selectAll")}
                  icon={selected ? "checkbox-outline" : "square-outline"}
                  variant="secondary"
                  onPress={() => setSelected((value) => !value)}
                  disabled={saving}
                />
                {selected && (
                  <Button title={t("premium.acceptAll")} variant="amber" onPress={acceptAll} loading={saving} icon="sparkles-outline" />
                )}
              </Card>
              {missions.map((mission) => (
                <PremiumMissionRow key={mission.id} mission={mission} scope="special" scopeId={province.id} selected={selected} />
              ))}
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  count: { color: colors.navy, fontSize: 14, fontWeight: "700" },
  guide: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
});
