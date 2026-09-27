import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Image, ImageSource } from "expo-image";
import { colors, radius, spacing } from "@/theme/colors";

type Variant = "flat" | "elevated" | "media";

interface Props {
  children?: React.ReactNode;
  style?: ViewStyle;
  variant?: Variant;
  /** Only used when variant="media" — renders a rounded photo header above children. */
  imageSource?: ImageSource | string;
  imageHeight?: number;
  /** Absolutely-positioned slot over the image (e.g. a favorite-heart icon or rating badge). */
  overlay?: React.ReactNode;
}

export function Card({
  children,
  style,
  variant = "flat",
  imageSource,
  imageHeight = 160,
  overlay,
}: Props) {
  return (
    <View
      style={[
        styles.card,
        variant === "elevated" && styles.elevated,
        variant === "media" && styles.mediaCard,
        style,
      ]}
    >
      {variant === "media" && imageSource ? (
        <View style={styles.mediaWrap}>
          <Image
            source={typeof imageSource === "string" ? { uri: imageSource } : imageSource}
            style={{ width: "100%", height: imageHeight }}
            contentFit="cover"
          />
          {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
        </View>
      ) : null}
      {children ? (
        variant === "media" ? (
          <View style={styles.mediaBody}>{children}</View>
        ) : (
          // No extra wrapper here: children must be direct children of the
          // outer View so a caller's `style` (e.g. flexDirection: "row")
          // actually arranges them, instead of only affecting a single-child
          // wrapper that ignores it.
          children
        )
      ) : null}
    </View>
  );
}

const shadow: ViewStyle = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1),
  },
  elevated: {
    borderWidth: 0,
    ...shadow,
  },
  mediaCard: {
    padding: 0,
    borderWidth: 0,
    overflow: "hidden",
    ...shadow,
  },
  mediaWrap: { position: "relative" },
  mediaBody: { padding: spacing(1.5), gap: spacing(0.5) },
  overlay: { position: "absolute", top: spacing(1), right: spacing(1) },
});
