import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserMissionsSummary } from "@/api/endpoints/missions";
import { GamificationSummary, MOCK_GAMIFICATION } from "@/mocks/gamification";
import { isDemoAccount } from "@/utils/demoAccount";

const EMPTY_GAMIFICATION: GamificationSummary = {
  points: 0,
  level: 1,
  pointsToNextTier: 500,
  nextTierName: "Bronze Tier",
};

// Simple, fixed thresholds — no real tier system exists elsewhere to defer
// to. Leveling (every 500 XP) is a separate, finer-grained concept from tier.
const TIERS: { threshold: number; name: string }[] = [
  { threshold: 0, name: "Bronze Tier" },
  { threshold: 1000, name: "Silver Tier" },
  { threshold: 3000, name: "Gold Tier" },
  { threshold: 6000, name: "Platinum Tier" },
  { threshold: 10000, name: "Diamond Tier" },
];

function deriveSummary(totalXP: number): GamificationSummary {
  const level = Math.floor(totalXP / 500) + 1;
  const nextTier = TIERS.find((tier) => tier.threshold > totalXP);
  return {
    points: totalXP,
    level,
    pointsToNextTier: nextTier ? nextTier.threshold - totalXP : 0,
    nextTierName: nextTier ? nextTier.name : TIERS[TIERS.length - 1].name,
  };
}

// Backed by Task.Presentation's GET api/user-missions/user/{userId}/summary
// (UserMissionController.GetSummary) — a real SUM over completed missions'
// reward fields, not mock data.
export function useGamification(): GamificationSummary {
  const { user } = useAuth();
  const [summary, setSummary] = useState<GamificationSummary>(EMPTY_GAMIFICATION);

  useEffect(() => {
    if (!user) {
      setSummary(EMPTY_GAMIFICATION);
      return;
    }
    if (isDemoAccount(user)) {
      setSummary(MOCK_GAMIFICATION);
      return;
    }
    let cancelled = false;
    getUserMissionsSummary(user.id)
      .then((res) => {
        if (!cancelled) setSummary(deriveSummary(res.totalXP));
      })
      .catch(() => {
        if (!cancelled) setSummary(EMPTY_GAMIFICATION);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return summary;
}
