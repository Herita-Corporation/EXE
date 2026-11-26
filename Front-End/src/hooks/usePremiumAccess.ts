import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getPremiumEntitlement } from "@/api/endpoints/premium";
import { useAuth } from "@/context/AuthContext";

export type PremiumAccessStatus = "loading" | "active" | "inactive" | "unavailable";

export function usePremiumAccess() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PremiumAccessStatus>(user ? "loading" : "inactive");
  const [expiresAtUtc, setExpiresAtUtc] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus("inactive");
      setExpiresAtUtc(null);
      return;
    }

    setStatus("loading");
    try {
      const entitlement = await getPremiumEntitlement();
      setStatus(entitlement.isPremium ? "active" : "inactive");
      setExpiresAtUtc(entitlement.expiresAtUtc);
    } catch {
      setStatus("unavailable");
      setExpiresAtUtc(null);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  useEffect(() => {
    if (status !== "active" || !expiresAtUtc) return;
    const delay = new Date(expiresAtUtc).getTime() - Date.now();
    if (delay <= 0) {
      setStatus("inactive");
      return;
    }
    const timer = setTimeout(() => setStatus("inactive"), Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAtUtc, status]);

  return { status, expiresAtUtc, refresh };
}
