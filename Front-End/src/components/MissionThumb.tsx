import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { MISSION_TYPE_PHOTO, MISSION_TYPE_VIDEO } from "@/types/missions";

/**
 * Mission avatar/thumbnail — once a mission is completed, uses the actual
 * submitted photo, or (for video evidence, which can't be frame-extracted
 * without a native video-thumbnail library) a poster-style tile with a play
 * icon. Falls back to a generic placeholder icon for missions with no
 * evidence yet (still in progress, or a check-in-only mission type).
 */
export function MissionThumb({
  evidenceUrl,
  evidenceType,
  size = 56,
}: {
  evidenceUrl?: string | null;
  evidenceType?: number | null;
  size?: number;
}) {
  if (evidenceUrl && evidenceType === MISSION_TYPE_PHOTO) {
    return (
      <Image
        source={{ uri: evidenceUrl }}
        style={[styles.thumb, { width: size, height: size }]}
        contentFit="cover"
      />
    );
  }
  if (evidenceUrl && evidenceType === MISSION_TYPE_VIDEO) {
    return (
      <View style={[styles.thumb, styles.videoThumb, { width: size, height: size }]}>
        <Ionicons name="play-circle" size={Math.round(size * 0.5)} color="#FFFFFF" />
      </View>
    );
  }
  return (
    <View style={[styles.thumb, styles.placeholderThumb, { width: size, height: size }]}>
      <Ionicons name="flag" size={Math.round(size * 0.4)} color={colors.blue} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  videoThumb: { backgroundColor: colors.navyCard },
  placeholderThumb: { backgroundColor: colors.blueSoft },
});
