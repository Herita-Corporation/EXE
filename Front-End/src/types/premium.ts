export interface PremiumPlan {
  id: string;
  name: string;
  periodMonths: number | null;
  priceVnd: number;
  specialMissions: boolean;
  groupMissions: boolean;
}

export interface PremiumSubscription {
  planId: string;
  expiresAt: string | null;
  active: boolean;
  demoCheckoutEnabled?: boolean;
}

export interface PremiumOrder {
  id: string;
  planId: string;
  planName: string;
  priceVnd: number;
  qrPayload: string;
}

export interface PremiumProvince {
  id: string;
  name: string;
}

export interface PremiumVoucher {
  id: string;
  rewardId: string;
  provider: string;
  category: string;
  kind: string;
  title: string;
  benefit: string;
  terms: string;
  scope: string;
  startsOn?: string | null;
  endsOn?: string | null;
  groupUse?: string | null;
  code?: string | null;
  disaPointCost: number;
}

export interface EarnedPremiumVoucher {
  voucher: PremiumVoucher;
  redemptionUrl: string;
}

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
  voucher: PremiumVoucher | null;
}

export interface PremiumGroup {
  id: string;
  provinceId: string;
  provinceName: string;
  memberCount: number;
  completedCount: number;
  members: { id: string; username: string }[];
}

export interface PremiumGroupDetail extends PremiumGroup {
  missions: PremiumMission[];
}

export type PremiumMissionScope = "special" | "group";
