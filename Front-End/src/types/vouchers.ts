// Task.Presentation's default ASP.NET Core System.Text.Json output (camelCase)
// -> camelCase here. See Task.Presentation/Controllers/VoucherController.cs.

export interface Voucher {
  id: string;
  category: string;
  title: string;
  description: string;
  imageUrl: string;
  pointsCost: number;
  discountLabel: string;
  location: string;
  expiresAt: string;
  code: string;
  terms: string[];
  isActive: boolean;
}

export interface OwnedVoucher {
  redemptionId: string;
  voucherId: string;
  category: string;
  title: string;
  imageUrl: string;
  code: string;
  expiresAt: string;
  redeemedAt: string;
}

export interface PointsBalance {
  earnedPoints: number;
  spentPoints: number;
  availablePoints: number;
}

export interface RedeemVoucherResult {
  redemptionId: string;
  remainingPoints: number;
}
