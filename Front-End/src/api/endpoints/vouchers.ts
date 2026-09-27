import { request } from "@/api/http";
import type {
  OwnedVoucher,
  PointsBalance,
  RedeemVoucherResult,
  Voucher,
  VoucherFormValues,
} from "@/types/vouchers";

// Base: <EXPO_PUBLIC_TASK_API_URL>/api/vouchers (Task.Presentation/Controllers/VoucherController.cs)
// GET routes and redeem/owned are open (matches this service's existing
// no-auth convention); POST/PUT/DELETE require the Admin role.

export function listVouchers() {
  return request<Voucher[]>("task", "/api/vouchers");
}

export function listAllVouchersForAdmin() {
  return request<Voucher[]>("task", "/api/vouchers/admin/all");
}

export function getVoucher(id: string) {
  return request<Voucher>("task", `/api/vouchers/${id}`);
}

export function createVoucher(payload: VoucherFormValues) {
  return request<{ voucherId: string; message: string }>("task", "/api/vouchers", {
    method: "POST",
    data: payload,
  });
}

export function updateVoucher(id: string, payload: VoucherFormValues) {
  return request<string>("task", `/api/vouchers/${id}`, {
    method: "PUT",
    data: payload,
  });
}

export function deleteVoucher(id: string) {
  return request<string>("task", `/api/vouchers/${id}`, { method: "DELETE" });
}

export function getOwnedVouchers(userId: string) {
  return request<OwnedVoucher[]>("task", `/api/vouchers/owned/${userId}`);
}

export function getPointsBalance(userId: string) {
  return request<PointsBalance>("task", `/api/vouchers/balance/${userId}`);
}

export function redeemVoucher(voucherId: string, userId: string) {
  return request<RedeemVoucherResult>("task", `/api/vouchers/${voucherId}/redeem`, {
    method: "POST",
    data: { userId },
  });
}
