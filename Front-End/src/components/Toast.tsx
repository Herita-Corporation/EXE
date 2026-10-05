import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "@/theme/colors";

export type ToastVariant = "success" | "error" | "info";

const VARIANT_STYLE: Record<ToastVariant, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle" },
  error: { bg: colors.dangerSoft, fg: colors.danger, icon: "alert-circle" },
  info: { bg: colors.blueSoft, fg: colors.navy, icon: "information-circle" },
};

interface ToastStackProps {
  toasts: { id: number; message: string; variant: ToastVariant }[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.stack, { top: insets.top + spacing(1) }]}>
      {toasts.map((t) => (
        <ToastItem key={t.id} message={t.message} variant={t.variant} onDismiss={() => onDismiss(t.id)} />
      ))}
    </View>
  );
}

function ToastItem({
  message,
  variant,
  onDismiss,
}: {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const style = VARIANT_STYLE[variant];

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: style.bg },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <Ionicons name={style.icon} size={20} color={style.fg} />
      <Text style={[styles.text, { color: style.fg }]} numberOfLines={3}>
        {message}
      </Text>
      <Ionicons name="close" size={16} color={style.fg} onPress={onDismiss} suppressHighlighting />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    left: spacing(2),
    right: spacing(2),
    gap: spacing(1),
    zIndex: 999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    borderRadius: radius.md,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(1.5),
    ...shadow,
  },
  text: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
});
