import type { TextStyle } from "react-native";

// DISA Travel brand palette (brand spec, exact hex values):
//   Navy #0B2D5B · Brand Blue #1E88FF · Blue Dark #1A74DC · Cyan #00D1FF
//   Amber #FFAB2B · Slate #4A5E7E · Navy Surface #24426C · Tint #E6F2FF
// Rules baked into the tokens below:
//   - 60/30/10: background (white / navy) · brand blue · amber.
//   - Brand blue = primary buttons, active tabs, icons, selected states,
//     progress (white text on it). Small text/links on white use Blue Dark.
//   - Amber = one CTA per screen, deals, notifications, stars. Text on amber
//     is always navy (`onAmber`).
//   - Cyan only on dark backgrounds — in light mode `link`/`accentOnDark`
//     never resolve to it.
//
// Light mode is back on the original logo-sampled look (on request): navy
// is the primary/CTA and selected-state color, blue (#1E88FF) is only an
// accent for links and icons, heroes are solid navy (the "gradient" is
// navy → navy), amber marks points/ratings plus one CTA per screen.
//
// Dark mode: StyleSheet.create() runs once at import time, so the scheme is
// read once at startup from the OS setting (app.json has
// userInterfaceStyle: "automatic"). Switching the phone's theme applies on
// the next app reload.
// Locked to light mode (on request) — the app always uses the light
// palette regardless of the phone's theme. The dark palette below is kept
// so it can be re-enabled by switching this back to
// `Appearance.getColorScheme() === "dark"`.
export const isDark: boolean = false;

/** Theme-independent brand constants — for things that sit on a fixed
 * colored surface (hero gradient, amber button, photo scrim). */
export const brand = {
  navy: "#0D2D5E",
  blue: "#1E88FF",
  blueDark: "#1E88FF",
  cyan: "#00D1FF",
  amber: "#FFA826",
  slate: "#4A5E7E",
  navySurface: "#24426C",
  tint: "#E6F0FD",
  white: "#FFFFFF",
  /** Brand gradient, 135° — hero banners and splash only. */
  gradient: ["#0D2D5E", "#0D2D5E"] as const,
};

const light = {
  background: "#F5F8FC",
  surface: "#FFFFFF",
  /** Inputs, segmented-control track, subtle fills. */
  surfaceAlt: "#EEF3FA",
  border: "#E2E9F3",
  /** Headings / strong ink. Brand navy in light mode, white in dark mode —
   * for a navy *background* use `brandNavy`. */
  navy: brand.navy,
  brandNavy: brand.navy,
  /** Dark card surface (insights, notices) that must stay dark in both modes. */
  navyCard: brand.navy,
  navyDeep: "#081D40",
  primary: brand.navy,
  primaryText: brand.white,
  blue: brand.blue,
  /** Small text & links. */
  link: brand.blueDark,
  /** Tinted fill for chips, badges, icon tiles, selected rows. */
  blueSoft: brand.tint,
  sky: "#5AA5FF",
  cyan: brand.cyan,
  gold: brand.amber,
  goldMuted: "#FFF0D6",
  /** Readable amber-family text on `goldMuted`. */
  goldText: "#B86E00",
  onAmber: "#0D2D5E",
  text: "#0F1B2D",
  textMuted: "#66758C",
  success: "#1FA971",
  successSoft: "#E3F6EE",
  danger: "#E5484D",
  dangerSoft: "#FDECEC",
  warning: "#F59E0B",
};

const dark: typeof light = {
  background: brand.navy,
  surface: brand.navySurface,
  surfaceAlt: "#1B3964",
  border: "#34547F",
  navy: brand.white,
  brandNavy: brand.navy,
  navyCard: brand.navySurface,
  navyDeep: "#071F42",
  primary: brand.blue,
  primaryText: brand.white,
  blue: brand.blue,
  link: brand.cyan,
  blueSoft: "#1D4A80",
  sky: "#5AA5FF",
  cyan: brand.cyan,
  gold: brand.amber,
  goldMuted: "#4A3C22",
  goldText: "#FFC46B",
  onAmber: brand.navy,
  text: brand.white,
  textMuted: "#B4C3DA",
  success: "#3DD598",
  successSoft: "#17463F",
  danger: "#FF6B70",
  dangerSoft: "#4A2437",
  warning: "#FBBF24",
};

export const colors = isDark ? dark : light;

/** Soft navy-tinted shadow shared by cards, tab bar and floating buttons. */
export const shadow = {
  shadowColor: isDark ? "#000000" : brand.navy,
  shadowOpacity: isDark ? 0.25 : 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

export const spacing = (n: number) => n * 8;

// Spec: rounded corners 12–16px; xl only for hero banners.
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

// System sans throughout — the logo is a geometric sans, and the old serif
// display face (Playfair) clashed with it.
export const typography: Record<string, TypographyStyle> = {
  display: { fontWeight: "800", fontSize: 28, lineHeight: 34 },
  h1: { fontWeight: "800", fontSize: 22, lineHeight: 28 },
  h2: { fontWeight: "700", fontSize: 18, lineHeight: 24 },
  body: { fontWeight: "400", fontSize: 15, lineHeight: 21 },
  bodyMuted: { fontWeight: "400", fontSize: 13, lineHeight: 18 },
  caption: { fontWeight: "500", fontSize: 12, lineHeight: 16 },
};
