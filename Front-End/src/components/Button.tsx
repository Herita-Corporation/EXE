import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme/colors";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";
type Shape = "rounded" | "pill";

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  /** Custom left-side icon (e.g. a multi-color logo) — takes precedence over `icon`. */
  leftElement?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  shape = "pill",
  icon,
  iconPosition = "left",
  leftElement,
  loading = false,
  disabled = false,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const textColor =
    variant === "ghost" || variant === "outline" || variant === "secondary"
      ? colors.navy
      : colors.primaryText;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        shape === "pill" ? styles.pill : styles.rounded,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {leftElement ? (
            <View style={styles.iconLeft}>{leftElement}</View>
          ) : icon && iconPosition === "left" ? (
            <Ionicons
              name={icon}
              size={sizeIconSize[size]}
              color={textColor}
              style={styles.iconLeft}
            />
          ) : null}
          <Text style={[styles.text, textSizeStyles[size], { color: textColor }]}>
            {title}
          </Text>
          {icon && iconPosition === "right" ? (
            <Ionicons
              name={icon}
              size={sizeIconSize[size]}
              color={textColor}
              style={styles.iconRight}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pill: { borderRadius: radius.pill },
  rounded: { borderRadius: radius.md },
  text: { fontWeight: "600" },
  iconLeft: { marginRight: spacing(1) },
  iconRight: { marginLeft: spacing(1) },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingVertical: spacing(1), paddingHorizontal: spacing(2) },
  md: { paddingVertical: spacing(1.5), paddingHorizontal: spacing(2.5) },
  lg: { paddingVertical: spacing(2), paddingHorizontal: spacing(3) },
};

const textSizeStyles: Record<Size, { fontSize: number }> = {
  sm: { fontSize: 13 },
  md: { fontSize: 16 },
  lg: { fontSize: 17 },
};

const sizeIconSize: Record<Size, number> = { sm: 16, md: 18, lg: 20 };

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceAlt },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: "transparent" },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
};
