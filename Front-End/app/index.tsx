import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { Image } from "expo-image";
import { useAuth } from "@/context/AuthContext";
import { hasSeenOnboarding } from "@/utils/onboardingStore";
import { colors, isDark } from "@/theme/colors";

/** Entry route: sends the user to the right stack once auth state is known. */
export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState(false);

  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      setOnboardingSeen(seen);
      setOnboardingChecked(true);
    });
  }, []);

  if (isLoading || !onboardingChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}
      >
        <Image
          source={
            isDark
              ? require("@/assets/images/brand/logo-vertical-white.png")
              : require("@/assets/images/brand/logo-vertical.png")
          }
          style={{ width: 150, aspectRatio: 900 / 1145 }}
          contentFit="contain"
        />
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  if (!isAuthenticated && !onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Redirect href={isAuthenticated ? "/(tabs)/home" : "/(auth)/login"} />
  );
}
