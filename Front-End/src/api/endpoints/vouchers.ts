import { request } from "@/api/http";
import type {
  OwnedVoucher,
  PointsBalance,
  RedeemVoucherResult,
  Voucher,
} from "@/types/vouchers";

// Base: <EXPO_PUBLIC_TASK_API_URL>/api/vouchers (Task.Presentation/Controllers/VoucherController.cs)
// The app only reads the catalog and redeems. The demo catalog ships with the
// service (Task.Infrastructure/Persistence/DemoVoucherSeeder.cs, run on startup).
// The public catalog omits each voucher's code — it comes from /owned after redeeming.

export function listVouchers() {
  return request<Voucher[]>("task", "/api/vouchers");
}

export function getVoucher(id: string) {
  return request<Voucher>("task", `/api/vouchers/${id}`);
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
