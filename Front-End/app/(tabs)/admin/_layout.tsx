import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

// Gate the whole admin route group on Admin/Manager roles (from JWT/`/me`,
// see AuthContext) — mirrors the backend's own [Authorize(Roles=...)] split
// between AdminController and ManagerController.
export default function AdminLayout() {
  const { user } = useAuth();
  const canAccess = !!user?.roles?.some((r) => r === "Admin" || r === "Manager");

  if (!canAccess) {
    return <Redirect href="/(tabs)/account" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="create-manager" />
      <Stack.Screen name="events/index" />
      <Stack.Screen name="events/create" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="vouchers/index" />
      <Stack.Screen name="vouchers/create" />
      <Stack.Screen name="vouchers/[id]" />
    </Stack>
  );
}
