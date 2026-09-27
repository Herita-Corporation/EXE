import type { TextStyle } from "react-native";

// Off-white / navy / gold luxury-travel palette (DISA Travel Figma redesign).
// "primary" stays as the semantic name existing components already use for
// their main CTA color, remapped from the old blue (#4F8CFF) to navy.
// navy/navyDeep/gold/goldMuted are a brighter/lighter pass over the original
// near-black navy (#0B2545) and muted gold (#C9A24B) — same hues, higher
// lightness, still enough contrast for white text. navy went brighter, then
// one tone back down after it read as too light (#235FAE was tried and
// walked back) — contrast for white text on navy checked ~8.9:1.
export const colors = {
  background: "#F8F9FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F2F4",
  border: "#E4E7EC",
  navy: "#1A4A85",
  navyDeep: "#123563",
  gold: "#D6B565",
  goldMuted: "#EAD9AC",
  primary: "#1A4A85",
  primaryText: "#FFFFFF",
  text: "#101826",
  textMuted: "#6B7280",
  success: "#2E9E6D",
  danger: "#E1543D",
  warning: "#D9A441",
};

export const spacing = (n: number) => n * 8;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
};

// The floating tab bar sits above the safe-area bottom inset, so scrollable
// screen content needs this much extra bottom padding to clear it — bar
// itself is offset spacing(1.5) above the inset, is TAB_BAR_HEIGHT tall, plus
// a small breathing-room buffer above that.
export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_CLEARANCE = spacing(1.5) + TAB_BAR_HEIGHT + spacing(2);

interface TypographyStyle {
  fontFamily?: string;
  fontWeight?: TextStyle["fontWeight"];
  fontSize: number;
  lineHeight: number;
}

// Serif display font (Playfair Display, loaded via useFonts in app/_layout.tsx)
// for headings; body text stays on the system font for performance/familiarity.
export const typography: Record<string, TypographyStyle> = {
  display: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 28, lineHeight: 34 },
  h1: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, lineHeight: 28 },
  h2: { fontWeight: "700", fontSize: 18, lineHeight: 24 },
  body: { fontWeight: "400", fontSize: 15, lineHeight: 21 },
  bodyMuted: { fontWeight: "400", fontSize: 13, lineHeight: 18 },
  caption: { fontWeight: "500", fontSize: 12, lineHeight: 16 },
};
