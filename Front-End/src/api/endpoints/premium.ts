import { request } from "@/api/http";
import type {
  PremiumEntitlement,
  PremiumPaymentStatus,
  PremiumPlan,
  PremiumQrPayment,
  PremiumProvince,
  PremiumMissionArea,
  PremiumMissionEligibility,
  PremiumMission,
  PremiumGroup,
  PremiumGroupDetail,
  EarnedPremiumOffer,
  PremiumVirtualVoucher,
} from "@/types/premium";

const ROOT = "/api/premium";

export function getPremiumPlans() {
  return request<PremiumPlan[]>("iam", `${ROOT}/plans`, { auth: false });
}

export function getPremiumEntitlement() {
  return request<PremiumEntitlement>("iam", `${ROOT}/me`);
}

export function createPremiumQrPayment(planCode: string) {
  return request<PremiumQrPayment>("iam", `${ROOT}/qr-payments`, {
    method: "POST",
    data: { planCode },
  });
}

export function getPremiumPayment(paymentId: number) {
  return request<PremiumPaymentStatus>("iam", `${ROOT}/payments/${paymentId}`);
}

export function getPremiumProvinces() { return request<PremiumProvince[]>("task", "/api/premium/provinces"); }
export function getPremiumMissionAreas() { return request<PremiumMissionArea[]>("task", "/api/premium/mission-areas"); }
export function getPremiumMissionEligibility(areaId: string) { return request<PremiumMissionEligibility>("task", `/api/premium/mission-areas/${areaId}/eligibility`); }
export function getSpecialMissions(provinceId: string) { return request<PremiumMission[]>("task", `/api/premium/special/${provinceId}`); }
export function acceptSpecialMissions(provinceId: string) { return request<PremiumMission[]>("task", `/api/premium/special/${provinceId}/accept-all`, { method: "POST" }); }
export function getPremiumGroups() { return request<PremiumGroup[]>("task", "/api/premium/groups"); }
export function getPremiumGroup(id: string) { return request<PremiumGroupDetail>("task", `/api/premium/groups/${id}`); }
export function createPremiumGroup(provinceId: string, accounts: string[]) { return request<PremiumGroup>("task", "/api/premium/groups", { method: "POST", data: { provinceId, accounts } }); }
export function getEarnedPremiumOffers() { return request<EarnedPremiumOffer[]>("task", "/api/premium/special-offers"); }
export function getPremiumVirtualVouchers() { return request<PremiumVirtualVoucher[]>("task", "/api/premium/vouchers"); }
export function submitPremiumMission(scope: "special" | "groups", scopeId: string, missionId: string, media: { uri: string; type: "photo" | "video" }) {
  const form = new FormData();
  const name = media.uri.split("/").pop() ?? (media.type === "photo" ? "evidence.jpg" : "evidence.mp4");
  form.append(media.type, { uri: media.uri, name, type: media.type === "photo" ? "image/jpeg" : "video/mp4" } as unknown as Blob);
  return request<PremiumMission[]>("task", `/api/premium/${scope}/${scopeId}/${missionId}/submit`, { method: "POST", data: form, headers: { "Content-Type": "multipart/form-data" }, timeoutMs: 120000 });
}
