import React from "react";
import { StyleSheet, type StyleProp } from "react-native";
import { Image, type ImageSource, type ImageStyle } from "expo-image";

export function PartnerLogoMark({
  source,
  label,
  style,
}: {
  source: ImageSource | number;
  label?: string;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={source}
      style={[styles.logo, style]}
      contentFit="contain"
      accessible={label !== undefined}
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  logo: { width: 64, height: 36 },
});
