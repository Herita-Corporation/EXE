import React, { useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { PaginationDots } from "@/components/PaginationDots";
import { ONBOARDING_SLIDES } from "@/mocks/onboarding";
import { markOnboardingSeen } from "@/utils/onboardingStore";
import { spacing, typography } from "@/theme/colors";

export default function OnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  async function finish() {
    await markOnboardingSeen();
    router.replace("/(auth)/login");
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  }

  function goNext() {
    if (index < ONBOARDING_SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    } else {
      finish();
    }
  }

  const current = ONBOARDING_SLIDES[index];

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {ONBOARDING_SLIDES.map((slide) => (
          <View key={slide.headline} style={{ width, height }}>
            <Image
              source={{ uri: slide.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient
              colors={["transparent", "rgba(8,27,51,0.95)"]}
              locations={[0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </ScrollView>

      <View style={[styles.topRow, { top: insets.top + spacing(1.5) }]}>
        <Text style={styles.wordmark}>DISA</Text>
        <Pressable onPress={finish} style={styles.skipPill}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing(2) }]}>
        <Text style={styles.headline}>{current.headline}</Text>
        <Text style={styles.description}>{current.description}</Text>
        <View style={styles.footerRow}>
          <PaginationDots count={ONBOARDING_SLIDES.length} activeIndex={index} />
        </View>
        <Button
          title={current.cta}
          onPress={goNext}
          icon={index < ONBOARDING_SLIDES.length - 1 ? "arrow-forward" : undefined}
          iconPosition="right"
          style={styles.cta}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topRow: {
    position: "absolute",
    left: spacing(2.5),
    right: spacing(2.5),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wordmark: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", letterSpacing: 1 },
  skipPill: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.75),
    borderRadius: 999,
    overflow: "hidden",
  },
  skipText: { color: "#FFFFFF", fontWeight: "600" },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing(2.5),
    gap: spacing(1.5),
  },
  headline: { ...typography.display, color: "#FFFFFF" },
  description: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },
  footerRow: { alignItems: "center", marginVertical: spacing(1) },
  cta: { marginTop: spacing(0.5) },
});
