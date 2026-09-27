import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image, ImageSource } from "expo-image";
import { colors } from "@/theme/colors";

interface Props {
  source?: ImageSource | string | null;
  name?: string;
  size?: number;
}

function initialsFrom(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/** Circular photo avatar, falling back to initials when no source is given. */
export function Avatar({ source, name, size = 44 }: Props) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (source) {
    return (
      <Image
        source={typeof source === "string" ? { uri: source } : source}
        style={dimension}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initialsFrom(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.primaryText, fontWeight: "700" },
});
