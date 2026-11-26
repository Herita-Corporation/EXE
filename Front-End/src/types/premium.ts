export interface PremiumPlan {
  id: number;
  code: string;
  name: string;
  durationMonths: number;
  priceVnd: number;
}

export interface PremiumEntitlement {
  userId: string;
  isPremium: boolean;
  status: "PREMIUM" | "FREE";
  subscriptionStatus?: "TRIAL" | "ACTIVE" | "FREE";
  planId: number | null;
  expiresAtUtc: string | null;
}

export interface PremiumQrPayment {
  paymentId: number;
  orderCode: string;
  planCode: string;
  planName: string;
  amount: number;
  status: string;
  qrUrl: string;
  bankCode: string;
  bankAccount: string;
  transferContent: string;
  expiresAtUtc: string;
}

export interface PremiumPaymentStatus {
  id: number;
  planId: number;
  provider: string;
  status: string;
  amountVnd: number;
  orderCode: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  paidAtUtc: string | null;
  accessUntilUtc: string | null;
}

export interface PremiumProvince { id: string; name: string; }
export type PremiumMissionScope = "special" | "groups";
export interface PremiumMission {
  id: string;
  provinceName: string;
  title: string;
  evidenceType: "photo" | "video";
  instruction: string;
  placeName: string;
  locality: string;
  placeQuery: string;
  accepted: boolean;
  completedAt: string | null;
}
export interface PremiumGroup {
  id: string;
  provinceId: string;
  provinceName: string;
  memberCount: number;
  completedCount: number;
  members: Array<{ id: string; username: string }>;
}
export interface PremiumGroupDetail extends PremiumGroup { missions: PremiumMission[]; }
export interface EarnedPremiumOffer {
  offer: {
    id: string;
    provider: string;
    category: string;
    title: string;
    benefit: string;
    terms: string;
    publicUrl: string;
    startsAtUtc: string | null;
    expiresAtUtc: string | null;
  };
  scope: "special" | "groups";
  scopeId: string;
  missionId: string;
}
