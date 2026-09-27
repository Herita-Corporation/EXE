import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { hasSeenOnboarding } from "@/utils/onboardingStore";
import { colors } from "@/theme/colors";

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
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
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
