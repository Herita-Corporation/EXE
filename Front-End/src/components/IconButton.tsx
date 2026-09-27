import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { colors } from "@/theme/colors";

type Variant = "ghost" | "solid" | "glass";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  variant?: Variant;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

/**
 * Circular icon-only pressable. `variant="glass"` renders a frosted
 * (expo-blur) backdrop for buttons floating over a photo — e.g. onboarding's
 * "Skip" pill or a back-arrow over a hero image.
 */
export function IconButton({
  icon,
  onPress,
  variant = "ghost",
  size = 22,
  color,
  style,
}: Props) {
  const dimension = size + 22;
  const iconColor = color ?? (variant === "glass" ? "#FFFFFF" : colors.navy);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        variant === "solid" && styles.solid,
        style,
      ]}
    >
      {variant === "glass" ? (
        <BlurView
          intensity={40}
          tint="dark"
          style={[
            styles.blur,
            { width: dimension, height: dimension, borderRadius: dimension / 2 },
          ]}
        />
      ) : null}
      <Ionicons name={icon} size={size} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  solid: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  blur: { position: "absolute", top: 0, left: 0 },
});
