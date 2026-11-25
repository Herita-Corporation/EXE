import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getPremiumSubscription } from "@/api/endpoints/premium";
import { useAuth } from "@/context/AuthContext";

type AccessStatus = "active" | "inactive" | "unavailable";

interface PremiumAccess {
  userId: string;
  status: AccessStatus;
  expiresAt: number;
}

export function usePremiumAccess() {
  const { user } = useAuth();
  const userId = user?.id;
  const [access, setAccess] = useState<PremiumAccess | null>(null);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let cancelled = false;
    setAccess((current) => current?.userId === userId && current.status === "active" ? current : null);
    getPremiumSubscription().then((subscription) => {
      if (cancelled) return;
      const expiresAt = Date.parse(subscription.expiresAt ?? "");
      const active = subscription.active && subscription.planId !== "basic" && expiresAt > Date.now();
      setAccess({ userId, status: active ? "active" : "inactive", expiresAt });
    }).catch(() => {
      if (!cancelled) setAccess({ userId, status: "unavailable", expiresAt: 0 });
    });
    return () => { cancelled = true; };
  }, [userId, attempt]));

  useEffect(() => {
    if (!access || access.status !== "active" || access.userId !== userId) return;
    const verifiedAccess = access;
    let timer: ReturnType<typeof setTimeout>;
    function checkExpiry() {
      const remaining = verifiedAccess.expiresAt - Date.now();
      if (remaining > 0) {
        // Long subscriptions exceed the maximum delay supported by setTimeout.
        timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647));
      } else {
        setAccess((current) => current === verifiedAccess ? { ...verifiedAccess, status: "inactive" } : current);
      }
    }
    checkExpiry();
    return () => clearTimeout(timer);
  }, [access, userId]);

  const current = access?.userId === userId ? access : null;
  let status: AccessStatus | "loading" = userId ? current?.status ?? "loading" : "inactive";
  if (current?.status === "active" && current.expiresAt <= Date.now()) status = "inactive";

  return { status, retry: () => setAttempt((value) => value + 1) };
}
