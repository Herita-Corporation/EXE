import type { Ionicons } from "@expo/vector-icons";

/**
 * Visual identity per voucher category (matches voucher.category from the
 * backend, kept in English). Each gets its own icon and a two-stop gradient
 * so the voucher list reads at a glance; unknown categories fall back to a
 * generic ticket in brand blue.
 */
export interface CategoryStyle {
  icon: keyof typeof Ionicons.glyphMap;
  /** Gradient for icon tiles (light → dark). */
  gradient: readonly [string, string];
  /** Solid tone for small icons / text on light backgrounds. */
  color: string;
  /** Soft background for pills/chips. */
  soft: string;
}

const STYLES: Record<string, CategoryStyle> = {
  Hotels: { icon: "bed", gradient: ["#5B8DEF", "#3557D6"], color: "#3557D6", soft: "#EAF0FE" },
  Dining: { icon: "restaurant", gradient: ["#FFC15A", "#F59E0B"], color: "#C77700", soft: "#FFF4DE" },
  Experience: { icon: "sparkles", gradient: ["#C084FC", "#8B5CF6"], color: "#7C4DE8", soft: "#F3EDFE" },
  Wellness: { icon: "leaf", gradient: ["#4ADE80", "#16A34A"], color: "#138A40", soft: "#E6F7EC" },
  Travel: { icon: "airplane", gradient: ["#38BDF8", "#0284C7"], color: "#0277B3", soft: "#E2F4FD" },
  Transport: { icon: "bus", gradient: ["#FB8A6E", "#EF5A3C"], color: "#D2462A", soft: "#FEEDE8" },
};

const FALLBACK: CategoryStyle = {
  icon: "ticket",
  gradient: ["#4FA3FF", "#1E88FF"],
  color: "#1E88FF",
  soft: "#E6F0FD",
};

/** "All Offers" filter chip. */
export const ALL_CATEGORY_ICON: keyof typeof Ionicons.glyphMap = "apps";

export function categoryStyle(category?: string | null): CategoryStyle {
  return (category && STYLES[category]) || FALLBACK;
}
