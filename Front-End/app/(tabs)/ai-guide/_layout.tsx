import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

export default function AiGuideLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="bahnar" />
    </Stack>
  );
}
