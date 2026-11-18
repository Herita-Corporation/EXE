import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, Tabs, router, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import { haptics } from "@/utils/haptics";
import { colors, radius, shadow, spacing, TAB_BAR_HEIGHT } from "@/theme/colors";

// A fully custom tabBar, not screenOptions.tabBarIcon — React Navigation's
// built-in tabBarIcon slot renders inside a fixed-size icon box that clips
// anything wider than a plain icon (the active pill's label was getting cut
// off, and the resulting width miscalculation is also what bunched every
// tab toward the right edge). Drawing the row ourselves avoids both.
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

// Show the bar on the five dashboards and the legacy mission dashboard.
// Sub-screens (mission detail, voucher detail, camera, chat, ...) hide it
// and use their own back buttons. Driven by the URL (usePathname) rather than
// the tabBar's own `state.routes[i].state`: that nested state only exists
// once a tab's Stack has mounted (lazy by default), so reading it caused the
// bar to flicker/hide even on root screens right after switching tabs.
const ROOT_PATHS = new Set(["/home", "/ai-guide", "/missions", "/mission", "/voucher", "/account"]);

const TAB_META: Record<string, {
  focused: keyof typeof Ionicons.glyphMap;
  unfocused: keyof typeof Ionicons.glyphMap;
  href: Href;
}> = {
  home: { focused: "home", unfocused: "home-outline", href: "/(tabs)/home" },
  "ai-guide": { focused: "chatbubble-ellipses", unfocused: "chatbubble-ellipses-outline", href: "/(tabs)/ai-guide" },
  missions: { focused: "trophy", unfocused: "trophy-outline", href: "/(tabs)/missions" },
  voucher: { focused: "pricetag", unfocused: "pricetag-outline", href: "/(tabs)/voucher" },
  account: { focused: "person", unfocused: "person-outline", href: "/(tabs)/account" },
};

function CustomTabBar({ state, descriptors, emitter }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { t } = useLocale();
  const tabLabels: Record<string, string> = {
    home: t("tabs.home"),
    "ai-guide": t("tabs.aiGuide"),
    missions: t("tabs.mission"),
    voucher: t("tabs.voucher"),
    account: t("tabs.account"),
  };

  if (!ROOT_PATHS.has(pathname)) {
    return null;
  }

  return (
    <View style={[styles.bar, { bottom: insets.bottom + spacing(1.5) }]}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const isFocused = state.index === index || (
          route.name === "missions" && state.routes[state.index]?.name === "mission"
        );

        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (event.defaultPrevented) return;
          if (!isFocused) haptics.tap();
          // The trophy opens the leaf missions screen. It never selects the
          // mission feature stack, which may still show an itinerary or event.
          if (route.name === "missions") {
            router.navigate(meta.href);
            return;
          }
          // Other tabs still return to their own root screens.
          const navigation = descriptors[route.key].navigation;
          const nestedState = navigation.getState().routes.find((item) => item.key === route.key)?.state;
          if (nestedState?.type === "stack" && nestedState.key) {
            navigation.dispatch({
              type: "POP_TO",
              target: nestedState.key,
              source: nestedState.routes[nestedState.index ?? 0]?.key,
              payload: { name: "index" },
            });
          }
          // The full href also selects index when the stack is unmounted
          // or was first entered through a Home quick action.
          router.navigate(meta.href);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={[styles.tabButton, isFocused && styles.tabButtonActive]}
            accessibilityRole="tab"
            accessibilityLabel={tabLabels[route.name]}
            accessibilityState={{ selected: isFocused }}
          >
            {isFocused ? (
              <View style={styles.activePill}>
                <Ionicons name={meta.focused} size={18} color="#FFFFFF" />
                <Text style={styles.activePillLabel} numberOfLines={1}>{tabLabels[route.name]}</Text>
              </View>
            ) : (
              <Ionicons name={meta.unfocused} size={22} color={colors.textMuted} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLocale();

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="ai-guide" options={{ title: t("tabs.aiGuide") }} />
      <Tabs.Screen name="missions" options={{ title: t("tabs.mission") }} />
      <Tabs.Screen name="voucher" options={{ title: t("tabs.voucher") }} />
      <Tabs.Screen name="account" options={{ title: t("tabs.account") }} />
      {/* Feature routes stay reachable without sharing the trophy tab's state. */}
      <Tabs.Screen name="mission" options={{ title: t("tabs.mission") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: spacing(2.5),
    right: spacing(2.5),
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(1.75),
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
    shadowOpacity: 0.12,
    elevation: 6,
  },
  tabButton: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: { flex: 2.2 },
  activePill: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.75),
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.75),
  },
  activePillLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", flexShrink: 1 },
});
