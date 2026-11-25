import { postMissionEvidence, type MissionEvidence } from "@/api/endpoints/missions";
import { request } from "@/api/http";
import type {
  EarnedPremiumVoucher,
  PremiumGroup,
  PremiumGroupDetail,
  PremiumMission,
  PremiumMissionScope,
  PremiumOrder,
  PremiumPlan,
  PremiumProvince,
  PremiumSubscription,
} from "@/types/premium";

const ROOT = "/api/premium";

export function getPremiumPlans() {
  return request<PremiumPlan[]>("task", `${ROOT}/plans`, { auth: false });
}

export function getPremiumSubscription() {
  return request<PremiumSubscription>("task", `${ROOT}/subscription`);
}

export function createPremiumOrder(planId: string) {
  return request<PremiumOrder>("task", `${ROOT}/orders`, {
    method: "POST",
    data: { planId },
  });
}

export function confirmPremiumOrder(orderId: string) {
  return request<PremiumSubscription>("task", `${ROOT}/orders/${encodeURIComponent(orderId)}/confirm`, {
    method: "POST",
  });
}

export function getPremiumProvinces() {
  return request<PremiumProvince[]>("task", `${ROOT}/provinces`);
}

export function getEarnedSpecialVouchers() {
  return request<EarnedPremiumVoucher[]>("task", `${ROOT}/special-vouchers`);
}

export function getSpecialMissions(provinceId: string) {
  return request<PremiumMission[]>("task", `${ROOT}/special/${encodeURIComponent(provinceId)}`);
}

export function acceptSpecialMissions(provinceId: string) {
  return request<PremiumMission[]>("task", `${ROOT}/special/${encodeURIComponent(provinceId)}/accept-all`, {
    method: "POST",
  });
}

export function acceptSpecialMission(provinceId: string, missionId: string) {
  return request<PremiumMission>("task", `${missionPath("special", provinceId, missionId)}/accept`, {
    method: "POST",
  });
}

export function getPremiumGroups() {
  return request<PremiumGroup[]>("task", `${ROOT}/groups`);
}

export function createPremiumGroup(provinceId: string, memberCount: number, accounts: string[]) {
  return request<PremiumGroup>("task", `${ROOT}/groups`, {
    method: "POST",
    data: { provinceId, memberCount, accounts },
  });
}

export function getPremiumGroup(groupId: string) {
  return request<PremiumGroupDetail>("task", `${ROOT}/groups/${encodeURIComponent(groupId)}`);
}

function missionPath(scope: PremiumMissionScope, scopeId: string, missionId: string) {
  const collection = scope === "special" ? "special" : "groups";
  return `${ROOT}/${collection}/${encodeURIComponent(scopeId)}/${encodeURIComponent(missionId)}`;
}

export function submitPremiumMission(
  scope: PremiumMissionScope,
  scopeId: string,
  missionId: string,
  evidence: MissionEvidence
) {
  return postMissionEvidence<PremiumMission>(`${missionPath(scope, scopeId, missionId)}/submit`, evidence);
}

export function redeemPremiumVoucher(scope: PremiumMissionScope, scopeId: string, missionId: string) {
  return request<{ redemptionUrl: string }>("task", `${missionPath(scope, scopeId, missionId)}/redeem`, {
    method: "POST",
  });
}
