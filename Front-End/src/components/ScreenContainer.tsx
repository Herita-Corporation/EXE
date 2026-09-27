import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, TAB_BAR_CLEARANCE } from "@/theme/colors";

type Edge = "top" | "bottom" | "left" | "right";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  refreshControl?: ScrollViewProps["refreshControl"];
  /** Which safe-area insets to respect. Default: all. */
  edges?: Edge[];
  /** Skip the default content padding — for full-bleed hero-photo screens
   * (onboarding, camera capture) that render their own edge-to-edge layout. */
  noPadding?: boolean;
  /** Add bottom padding so scrollable content can clear the floating tab
   * bar instead of being hidden behind it. Every screen under (tabs) should
   * set this; screens outside the tab navigator (auth) don't need it. */
  avoidTabBar?: boolean;
  /** Override the default off-white background. */
  backgroundColor?: string;
}

const ALL_EDGES: Edge[] = ["top", "bottom", "left", "right"];

/** Consistent padded, themed background for every screen. */
export function ScreenContainer({
  children,
  scroll = true,
  style,
  refreshControl,
  edges = ALL_EDGES,
  noPadding = false,
  avoidTabBar = false,
  backgroundColor = colors.background,
}: Props) {
  const insets = useSafeAreaInsets();

  // Full-bleed screens compute their own insets for overlay positioning
  // (see onboarding.tsx) — applying safe-area padding here too would push
  // the hero image down from the true top edge.
  const safeAreaStyle: ViewStyle = noPadding
    ? {}
    : {
        paddingTop: edges.includes("top") ? insets.top : 0,
        paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
        paddingLeft: edges.includes("left") ? insets.left : 0,
        paddingRight: edges.includes("right") ? insets.right : 0,
      };

  const content = (
    <View style={[noPadding ? styles.contentNoPadding : styles.content, style]}>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor }, safeAreaStyle]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, avoidTabBar && { paddingBottom: TAB_BAR_CLEARANCE }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, padding: spacing(2.5), gap: spacing(2) },
  contentNoPadding: { flex: 1 },
});
