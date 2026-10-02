import React from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { brand, radius, shadow, spacing } from "@/theme/colors";

/**
 * Hero banner on the brand gradient (#1E88FF → #0B2D5B, 135°) with the
 * white brand mark faintly bleeding off one corner. Per the brand spec the
 * gradient is reserved for hero banners/splash — use this, not a raw
 * LinearGradient, so every hero looks the same. Content on it is white;
 * cyan is allowed here as an accent (dark background).
 */
export function GradientHero({
  children,
  style,
  markPosition = "bottom-right",
  markStyle,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  markPosition?: "bottom-right" | "top-right";
  /** Overrides for the decorative mark (size/offset/opacity differ per screen). */
  markStyle?: object;
}) {
  return (
    <LinearGradient
      colors={brand.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, style]}
    >
      <Image
        source={require("@/assets/images/brand/mark-white.png")}
        style={[styles.mark, markPosition === "top-right" ? styles.markTop : styles.markBottom, markStyle]}
        contentFit="contain"
      />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: spacing(2.5),
    gap: spacing(1.5),
    overflow: "hidden",
    ...shadow,
  },
  mark: {
    position: "absolute",
    right: -30,
    width: 170,
    aspectRatio: 600 / 540,
    opacity: 0.12,
  },
  markBottom: { bottom: -30 },
  markTop: { top: -20 },
});
