import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/theme/colors";

/** Pulsing placeholder block shown while content loads. */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

/** A list-row placeholder: thumbnail + two text lines, inside a card. */
export function SkeletonRow({ thumbSize = 56 }: { thumbSize?: number }) {
  return (
    <View style={styles.row}>
      <Skeleton style={{ width: thumbSize, height: thumbSize, borderRadius: 14 }} />
      <View style={styles.lines}>
        <Skeleton style={{ width: "40%", height: 12 }} />
        <Skeleton style={{ width: "85%", height: 14 }} />
        <Skeleton style={{ width: "55%", height: 12 }} />
      </View>
    </View>
  );
}

/** A media-card placeholder: image area + text lines. */
export function SkeletonCard({ imageHeight = 150 }: { imageHeight?: number }) {
  return (
    <View style={styles.card}>
      <Skeleton style={{ height: imageHeight, borderRadius: 0 }} />
      <View style={styles.cardBody}>
        <Skeleton style={{ width: "70%", height: 14 }} />
        <Skeleton style={{ width: "90%", height: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    padding: spacing(2),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lines: { flex: 1, gap: spacing(0.75) },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { padding: spacing(1.5), gap: spacing(0.75) },
});
