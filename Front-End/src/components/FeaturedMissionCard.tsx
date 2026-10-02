import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { FEATURED_MISSION_KIND, FeaturedMission } from "@/mocks/featuredMissions";
import { brand, colors, radius, shadow, spacing } from "@/theme/colors";

/**
 * Photo card for an illustrative mission: full-bleed image, dark gradient
 * scrim, mission type chip on top, title/place/reward on the bottom.
 * `variant="wide"` stretches to the container (Mission tab list);
 * the default fixed width suits a horizontal carousel (Home).
 */
export function FeaturedMissionCard({
  mission,
  onPress,
  variant = "carousel",
  style,
}: {
  mission: FeaturedMission;
  onPress?: () => void;
  variant?: "carousel" | "wide";
  style?: ViewStyle;
}) {
  const kind = FEATURED_MISSION_KIND[mission.kind];
  const height = variant === "wide" ? 170 : 200;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        variant === "carousel" ? { width: 230 } : null,
        { height },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <Image source={{ uri: mission.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <LinearGradient
        colors={["rgba(8,29,64,0)", "rgba(8,29,64,0.35)", "rgba(8,29,64,0.92)"]}
        locations={[0.25, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topRow}>
        <View style={styles.kindChip}>
          <Ionicons name={kind.icon} size={12} color={brand.navy} />
          <Text style={styles.kindText}>{kind.label}</Text>
        </View>
        <View style={styles.difficulty}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.difficultyDot, i <= mission.difficulty && styles.difficultyDotOn]}
            />
          ))}
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.title} numberOfLines={2}>{mission.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location" size={12} color="rgba(255,255,255,0.8)" />
          <Text style={styles.place} numberOfLines={1}>{mission.place}</Text>
        </View>
        <View style={styles.rewardRow}>
          <View style={styles.rewardPill}>
            <Ionicons name="flash" size={11} color={brand.navy} />
            <Text style={styles.rewardText}>+{mission.rewardXP} XP</Text>
          </View>
          <View style={[styles.rewardPill, styles.coinPill]}>
            <Ionicons name="star" size={11} color={colors.gold} />
            <Text style={[styles.rewardText, { color: "#FFFFFF" }]}>+{mission.rewardCoins}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: brand.navy,
    justifyContent: "space-between",
    ...shadow,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing(1.25),
  },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing(1),
  },
  kindText: { fontSize: 11, fontWeight: "700", color: brand.navy },
  difficulty: {
    flexDirection: "row",
    gap: 3,
    backgroundColor: "rgba(8,29,64,0.45)",
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  difficultyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  difficultyDotOn: { backgroundColor: colors.gold },
  bottom: { padding: spacing(1.5), gap: 4 },
  title: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  place: { color: "rgba(255,255,255,0.85)", fontSize: 12, flexShrink: 1 },
  rewardRow: { flexDirection: "row", gap: spacing(0.75), marginTop: spacing(0.5) },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.cyan,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing(1),
  },
  coinPill: { backgroundColor: "rgba(255,255,255,0.18)" },
  rewardText: { fontSize: 11, fontWeight: "800", color: brand.navy },
});
