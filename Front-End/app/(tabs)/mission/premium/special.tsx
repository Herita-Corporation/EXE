import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { acceptSpecialMissions, getPremiumMissionAreas, getPremiumMissionEligibility, getSpecialMissions } from "@/api/endpoints/premium";
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
import type { PremiumMission, PremiumMissionArea, PremiumMissionEligibility } from "@/types/premium";

export default function SpecialMissionsScreen() {
  return <PremiumAccessGate from="special"><SpecialMissionsContent /></PremiumAccessGate>;
}

function SpecialMissionsContent() {
  const { t } = useLocale();
  const [areas, setAreas] = useState<PremiumMissionArea[]>([]);
  const [area, setArea] = useState<PremiumMissionArea>();
  const [eligibility, setEligibility] = useState<PremiumMissionEligibility>();
  const [missions, setMissions] = useState<PremiumMission[]>([]);
  const [selected, setSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const busy = useRef(false);
  const {destination} = useLocalSearchParams<{destination?: string}>();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    const load = area
      ? Promise.all([getSpecialMissions(area.id), getPremiumMissionEligibility(area.id)]).then(([list, nextEligibility]) => {
        if (!cancelled) { setMissions(list); setEligibility(nextEligibility); }
      })
      : getPremiumMissionAreas().then((list) => { if (!cancelled) {
          setAreas(list);
          const norm = (s:string) => " " + s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/[^a-z0-9]+/g," ").trim() + " ";
          const dest = norm(destination ?? "");
          const match = list.find(a => dest.includes(norm(a.name))) ?? list.find(a => a.areaType === "PROVINCE" && a.aliases.some(s => dest.includes(norm(s))));
          if (match) setArea(match);
        } });
    load.catch((err) => {
      if (!cancelled) { setError(err instanceof ApiError ? err.message : t("premium.loadFailed")); setMissions([]); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [area, destination, loadVersion, t]));

  function createItinerary() {
    if (!area) return;
    router.push({
      pathname: "/(tabs)/mission/create",
      params: { missionAreaId: area.id, missionAreaName: area.name, specialMission: "1" },
    });
  }

  async function acceptAll() {
    if (!area || busy.current) return;
    if (!eligibility?.eligible) { createItinerary(); return; }
    busy.current = true; setSaving(true); setError(null);
    try {
      setMissions(await acceptSpecialMissions(area.id));
      setSelected(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PREMIUM_ONGOING_ITINERARY_REQUIRED") {
        createItinerary();
      } else setError(err instanceof ApiError ? err.message : t("premium.acceptFailed"));
    } finally { busy.current = false; setSaving(false); }
  }

  const acceptedCount = missions.filter((mission) => mission.accepted).length;
  return (
    <ScreenContainer>
      <BackHeader title={t("premium.special")} onBack={() => router.navigate("/(tabs)/missions")} />
      <Text style={styles.guide}>Chọn tỉnh/thành hoặc điểm đến. Mỗi khu vực có 10 nhiệm vụ; bạn chỉ nhận được khi có hành trình đang diễn ra tại đó.</Text>
      <PremiumProvincePicker
        provinces={areas}
        selected={area}
        onSelect={(next) => { if (!busy.current || next.id !== area?.id) { setMissions([]); setEligibility(undefined); setSelected(false); setArea(next); } }}
      />
      {area && <PartnerRecommendations destinations={[area.name, area.parentProvinceName ?? ""]} />}
      <ErrorBanner message={error} />
      {loading ? <ActivityIndicator color={colors.navy} /> : <>
        {!area && areas.length === 0 && <Card><Text style={styles.guide}>Chưa có khu vực nhiệm vụ. Vui lòng thử tải lại.</Text></Card>}
        {error && missions.length === 0 && <Button title={t("premium.retry")} variant="outline" onPress={() => setLoadVersion((version) => version + 1)} />}
        {area && <>
          <Card>
            <Text style={styles.count}>{acceptedCount}/10 nhiệm vụ đã nhận</Text>
            <Text style={styles.guide}>{eligibility?.eligible ? "Hành trình của bạn đang diễn ra tại khu vực này. Hoàn thành để nhận thưởng trực tiếp; thử thách có GPS còn có điểm thưởng theo khung giờ." : eligibility?.message ?? "Đang kiểm tra hành trình đang diễn ra..."}</Text>
            {eligibility?.eligible ? <>
              <Button title={t("premium.selectAll")} icon={selected ? "checkbox-outline" : "square-outline"} variant="secondary" onPress={() => setSelected((value) => !value)} disabled={saving} />
              {selected && <Button title={t("premium.acceptAll")} variant="amber" onPress={acceptAll} loading={saving} icon="sparkles-outline" />}
            </> : <Button title="Tạo hành trình tại khu vực này" icon="map-outline" variant="amber" onPress={createItinerary} />}
          </Card>
          {missions.map((mission) => <PremiumMissionRow key={mission.id} mission={mission} scope="special" scopeId={area.id} selected={selected} />)}
        </>}
      </>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  count: { color: colors.navy, fontSize: 14, fontWeight: "700" },
  guide: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
});
