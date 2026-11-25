import { request } from "@/api/http";
import type {
  PremiumEntitlement,
  PremiumPaymentStatus,
  PremiumPlan,
  PremiumQrPayment,
  PremiumProvince,
  PremiumMission,
  PremiumGroup,
  PremiumGroupDetail,
  EarnedPremiumVoucher,
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
export function getSpecialMissions(provinceId: string) { return request<PremiumMission[]>("task", `/api/premium/special/${provinceId}`); }
export function acceptSpecialMissions(provinceId: string) { return request<PremiumMission[]>("task", `/api/premium/special/${provinceId}/accept-all`, { method: "POST" }); }
export function getPremiumGroups() { return request<PremiumGroup[]>("task", "/api/premium/groups"); }
export function getPremiumGroup(id: string) { return request<PremiumGroupDetail>("task", `/api/premium/groups/${id}`); }
export function createPremiumGroup(provinceId: string, accounts: string[]) { return request<PremiumGroup>("task", "/api/premium/groups", { method: "POST", data: { provinceId, accounts } }); }
export function getEarnedPremiumVouchers() { return request<EarnedPremiumVoucher[]>("task", "/api/premium/special-vouchers"); }
export function submitPremiumMission(scope: "special" | "groups", scopeId: string, missionId: string, media: { uri: string; type: "photo" | "video" }) {
  const form = new FormData();
  const name = media.uri.split("/").pop() ?? (media.type === "photo" ? "evidence.jpg" : "evidence.mp4");
  form.append(media.type, { uri: media.uri, name, type: media.type === "photo" ? "image/jpeg" : "video/mp4" } as unknown as Blob);
  return request<PremiumMission[]>("task", `/api/premium/${scope}/${scopeId}/${missionId}/submit`, { method: "POST", data: form, headers: { "Content-Type": "multipart/form-data" }, timeoutMs: 120000 });
}
export function redeemPremiumMission(scope: "special" | "groups", scopeId: string, missionId: string) { return request<{ redemptionUrl: string | null; code: string }>("task", `/api/premium/${scope}/${scopeId}/${missionId}/redeem`, { method: "POST" }); }
