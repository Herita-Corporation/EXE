import { request } from "@/api/http";

// Base: <EXPO_PUBLIC_IAM_API_URL>/api/premium (IAMService/Controllers/PremiumController.cs)

export interface PremiumStatus {
  isPremium: boolean;
  premiumExpiresAt: string | null;
}

export interface VerifyPurchaseRequest {
  productId: string;
  purchaseToken: string;
}

export function getPremiumStatus() {
  return request<PremiumStatus>("iam", "/api/premium/status");
}

export function verifyPurchase(payload: VerifyPurchaseRequest) {
  return request<PremiumStatus>("iam", "/api/premium/verify-purchase", {
    method: "POST",
    data: payload,
  });
}
