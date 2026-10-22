import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

export default function MissionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="itineraries" />
      <Stack.Screen name="create" />
      {/* Swipe-to-back would fight the mission swipe sliders; back via the arrow only */}
      <Stack.Screen
        name="itinerary/[id]"
        options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="camera" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="record" />
      <Stack.Screen name="completed" />
      <Stack.Screen name="events/index" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="collection/index" />
      <Stack.Screen name="collection/[id]" />
    </Stack>
  );
}
