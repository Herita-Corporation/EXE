import AsyncStorage from "@react-native-async-storage/async-storage";
import { request } from "@/api/http";
import { getAccessToken } from "@/utils/tokenStore";
import { decodeJwt } from "@/utils/jwt";

export interface PartnerOffer {
  campaignId: string; locationId: string; partnerName: string; address: string;
  title: string; terms: string; discountType: string; percentageBps: number;
  fixedAmount: number; minSpend: number; claimEndsAt: string; redeemEndsAt: string;
  validityDescription: string; ownedVoucherId?: string | null; canClaim: boolean;
}
export interface PartnerVoucher {
  voucherId: string; voucherRef: string; campaignId: string; locationId: string;
  title: string; terms: string; locationName: string; address: string;
  status: "ISSUED" | "REDEEMED" | "EXPIRED" | "REVOKED";
  displayState: string; redeemableFrom: string; expiresAt: string; redeemedAt?: string;
  canPresent: boolean; serverNow: string;
}
export interface VoucherPresentation { presentationId: string; qrPayload: string; shortCode: string; expiresAt: string; serverNow: string }
export const listPartnerOffers = (locationId?: string, tripId?: string) => tripId ? request<PartnerOffer[]>("task", `/api/v2/me/trips/${tripId}/offers`) : request<PartnerOffer[]>("task", "/api/v2/me/offers", { params: { surface: "home", locationId } });
export const partnerWallet = (bucket: "active" | "history") => request<PartnerVoucher[]>("task", "/api/v2/me/vouchers", { params: { bucket } });
export const partnerVoucher = (id: string) => request<PartnerVoucher>("task", `/api/v2/me/vouchers/${id}`);
export const presentPartnerVoucher = (id: string) => request<VoucherPresentation>("task", `/api/v2/me/vouchers/${id}/presentations`, { method: "POST" });
export const revokePartnerPresentation = (id: string) => request<void>("task", `/api/v2/me/vouchers/${id}/presentations/current`, { method: "DELETE" });

// Keep only the non-secret action key/context across a network retry. Never
// persist the presentation QR, short code or staff verification ticket.
export async function claimPartnerVoucher(userId: string, campaignId: string, contextToken: string | null = null, tripId: string | null = null) {
  const storageKey = `pv.claim.${userId}.${campaignId}`;
  const raw = await AsyncStorage.getItem(storageKey);
  let action: { key: string; contextToken: string | null; tripId: string | null } | null = null;
  try { action = raw ? JSON.parse(raw) : null; } catch { /* regenerate corrupt non-secret cache */ }
  if (!action || action.contextToken !== contextToken || action.tripId !== tripId) {
    action = { key: `claim-${Date.now()}-${Math.random().toString(36).slice(2)}`, contextToken, tripId };
    await AsyncStorage.setItem(storageKey, JSON.stringify(action));
  }
  const token = getAccessToken();
  if (!token || decodeJwt(token)?.sub !== userId) throw new Error("Account changed. Please reopen the offer.");
  return request<PartnerVoucher>("task", `/api/v2/me/campaigns/${campaignId}/claim`, {
    method: "POST", headers: { "Idempotency-Key": action.key }, data: { acquisitionContextToken: contextToken, tripId },
  });
}
