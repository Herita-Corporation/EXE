import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  acceptSpecialMission,
  getPremiumGroup,
  getSpecialMissions,
  redeemPremiumVoucher,
  submitPremiumMission,
} from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { BackHeader } from "@/components/BackHeader";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { GradientHero } from "@/components/GradientHero";
import { MissionEvidencePicker, useMissionEvidence } from "@/components/MissionEvidencePicker";
import { PremiumAccessGate } from "@/components/PremiumAccessGate";
import { PremiumVoucherCard } from "@/components/PremiumVoucherCard";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useToast } from "@/context/ToastContext";
import { usePartnerOfferLink } from "@/hooks/usePartnerOfferLink";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";
import type { PremiumMission, PremiumVoucher } from "@/types/premium";
import { formatDate } from "@/utils/date";
import { haptics } from "@/utils/haptics";

export default function PremiumMissionEvidenceScreen() {
  return <PremiumAccessGate><PremiumMissionEvidenceContent /></PremiumAccessGate>;
}

function PremiumMissionEvidenceContent() {
  const { missionId, scope, scopeId } = useLocalSearchParams<{
    missionId: string;
    scope?: string;
    scopeId?: string;
  }>();
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const openPartnerOffer = usePartnerOfferLink();
  const [mission, setMission] = useState<PremiumMission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);
  const [action, setAction] = useState<"accept" | "submit" | "redeem" | null>(null);
  const busy = useRef(false);
  const missionChanges = useRef(0);
  const evidence = useMissionEvidence(mission?.title ?? t("missionDetail.fallbackTitle"));
  const isGroup = scope === "group";
  const validScope = scope === "special" || scope === "group";

  useFocusEffect(useCallback(() => {
    if (!scopeId || !validScope) {
      setLoading(false);
      setError(t("missionDetail.notFound"));
      return;
    }
    let cancelled = false;
    const changesAtLoad = missionChanges.current;
    setError(null);
    const list = isGroup ? getPremiumGroup(scopeId).then((group) => group.missions) : getSpecialMissions(scopeId);
    list.then((missions) => {
      if (cancelled || missionChanges.current !== changesAtLoad) return;
      const next = missions.find((item) => item.id === missionId) ?? null;
      setMission(next);
      if (!next) setError(t("missionDetail.notFound"));
    }).catch((err) => {
      if (cancelled) return;
      const accessDenied = err instanceof ApiError && (err.status === 401 || err.status === 403);
      if (!accessDenied && missionChanges.current !== changesAtLoad) return;
      setMission(null);
      setError(err instanceof ApiError ? err.message : t("premium.loadFailed"));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isGroup, validScope, missionId, scopeId, loadVersion, t]));

  const requiresVideo = mission?.evidenceType === "video";

  async function accept() {
    if (!scopeId || !mission || busy.current) return;
    busy.current = true;
    setAction("accept");
    try {
      const updated = await acceptSpecialMission(scopeId, mission.id);
      missionChanges.current++;
      setMission(updated);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("premium.acceptFailed"), "error");
    } finally {
      busy.current = false;
      setAction(null);
    }
  }

  async function submit() {
    if (!scopeId || !mission || !validScope || busy.current) return;
    if (!(requiresVideo ? evidence.video : evidence.photo)) return;
    busy.current = true;
    setAction("submit");
    try {
      const updated = await submitPremiumMission(scope, scopeId, mission.id, {
        photo: requiresVideo ? undefined : evidence.photo,
        video: requiresVideo ? evidence.video : undefined,
        takenAt: new Date().toISOString(),
      });
      missionChanges.current++;
      setMission(updated);
      haptics.success();
      showToast(t(updated.voucher?.kind === "issued_code" ? "premium.issuedVoucherReceived" : "premium.proofAccepted"), "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("missionDetail.submitFailed"), "error");
    } finally {
      busy.current = false;
      setAction(null);
    }
  }

  async function redeem(voucher: PremiumVoucher) {
    if (!scopeId || !mission || !validScope || busy.current) return;
    busy.current = true;
    setAction("redeem");
    try {
      const { redemptionUrl } = await redeemPremiumVoucher(scope, scopeId, mission.id);
      await openPartnerOffer({ redemptionUrl, expiresOn: voucher.endsOn ?? undefined });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("partnerOffer.openFailed"), "error");
    } finally {
      busy.current = false;
      setAction(null);
    }
  }

  function onBack() {
    if (router.canGoBack()) router.back();
    else router.replace(isGroup ? "/(tabs)/mission/premium/groups" : "/(tabs)/mission/premium/special");
  }

  return (
    <ScreenContainer
      refreshControl={<RefreshControl
        refreshing={loading}
        onRefresh={() => {
          if (busy.current) return;
          setLoading(true);
          setLoadVersion((version) => version + 1);
        }}
        tintColor={colors.navy}
      />}
    >
      <BackHeader title={t(isGroup ? "premium.groups" : "premium.special")} onBack={onBack} />
      <ErrorBanner message={error} />
      {!mission ? loading ? <ActivityIndicator color={colors.navy} /> : (
        <Button title={t("premium.retry")} variant="outline" onPress={() => setLoadVersion((version) => version + 1)} />
      ) : (
        <>
          <GradientHero>
            <View style={styles.row}>
              <Badge label={t(requiresVideo ? "premium.video" : "premium.photo")} tone="tint" />
              {mission.completedAt && <Badge label={t("premium.completed")} tone="success" />}
            </View>
            <Text style={styles.heroTitle}>{mission.title}</Text>
            <View style={styles.row}>
              <Ionicons name="location-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroPlace}>{mission.placeName} · {mission.locality}, {mission.provinceName}</Text>
            </View>
          </GradientHero>
          <Card>
            <Text style={styles.title}>{t("premium.instructions")}</Text>
            <Text style={styles.body}>{mission.instruction}</Text>
            {mission.completedAt && (
              <Text style={styles.body}>{formatDate(mission.completedAt, locale)}</Text>
            )}
          </Card>
          {mission.voucher ? (
            <PremiumVoucherCard voucher={mission.voucher} shared={isGroup} onOpen={redeem} opening={action === "redeem"} />
          ) : mission.completedAt ? null : isGroup || mission.accepted ? (
            <Card>
              <Text style={styles.title}>{t("missionDetail.submitTitle")}</Text>
              <MissionEvidencePicker evidence={evidence} requiresPhoto={!requiresVideo} requiresVideo={requiresVideo} allowVideoLibrary />
              <Button
                title={t("missionDetail.submit")}
                onPress={submit}
                loading={action === "submit"}
                disabled={requiresVideo ? !evidence.video : !evidence.photo}
              />
            </Card>
          ) : (
            <Button title={t("premium.acceptOne")} onPress={accept} loading={action === "accept"} icon="add-circle-outline" />
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing(0.75) },
  heroTitle: { fontSize: 23, lineHeight: 29, color: "#FFFFFF", fontWeight: "800" },
  heroPlace: { flex: 1, fontSize: 14, lineHeight: 19, color: "#FFFFFF" },
  title: { fontSize: 15, fontWeight: "700", color: colors.navy },
  body: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
