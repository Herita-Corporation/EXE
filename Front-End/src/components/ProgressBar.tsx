import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius } from "@/theme/colors";

interface Props {
  /** 0..1 */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  color = colors.gold,
  trackColor = colors.surfaceAlt,
  height = 8,
  style,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={[
        styles.track,
        { backgroundColor: trackColor, height, borderRadius: radius.pill },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          { backgroundColor: color, width: `${clamped * 100}%`, borderRadius: radius.pill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },
  fill: { height: "100%" },
});
