import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

export default function VoucherLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="collection" />
    </Stack>
  );
}
