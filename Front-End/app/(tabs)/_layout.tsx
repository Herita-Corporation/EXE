import React, { useRef } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { Redirect, Tabs, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, shadow, spacing, TAB_BAR_HEIGHT } from "@/theme/colors";

// A fully custom tabBar, not screenOptions.tabBarIcon — React Navigation's
// built-in tabBarIcon slot renders inside a fixed-size icon box that clips
// anything wider than a plain icon (the active pill's label was getting cut
// off, and the resulting width miscalculation is also what bunched every
// tab toward the right edge). Drawing the row ourselves avoids both.
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

// The 5 tab roots — bar shows only on these; every sub-screen (mission
// detail, voucher detail, camera, chat, ...) hides it and relies on its own
// back button instead. Driven by the actual URL (usePathname) rather than
// the tabBar's own `state.routes[i].state`: that nested state only exists
// once a tab's Stack has mounted (lazy by default), so reading it caused the
// bar to flicker/hide even on root screens right after switching tabs.
const ROOT_PATHS = new Set(["/home", "/ai-guide", "/mission", "/voucher", "/account"]);

// Old architecture on Android needs this opt-in for LayoutAnimation; a no-op
// under the new architecture / Fabric, and on iOS.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_META: Record<string, { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }> = {
  home: { focused: "home", unfocused: "home-outline" },
  "ai-guide": { focused: "chatbubble-ellipses", unfocused: "chatbubble-ellipses-outline" },
  mission: { focused: "trophy", unfocused: "trophy-outline" },
  voucher: { focused: "pricetag", unfocused: "pricetag-outline" },
  account: { focused: "person", unfocused: "person-outline" },
};

function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { t } = useLocale();
  const tabLabels: Record<string, string> = {
    home: t("tabs.home"),
    "ai-guide": t("tabs.aiGuide"),
    mission: t("tabs.mission"),
    voucher: t("tabs.voucher"),
    account: t("tabs.account"),
  };

  // The active pill is wider than a plain icon, so switching tabs changes
  // every item's width — which, with justifyContent: space-between, shifts
  // every other item's x position too. Triggering a LayoutAnimation right
  // before that width/position change commits turns it into a smooth slide
  // instead of an instant jump.
  const prevIndexRef = useRef(state.index);
  if (prevIndexRef.current !== state.index) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    prevIndexRef.current = state.index;
  }

  if (!ROOT_PATHS.has(pathname)) {
    return null;
  }

  return (
    <View style={[styles.bar, { bottom: insets.bottom + spacing(1.5) }]}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (event.defaultPrevented) return;
          // Always land on that tab's own root screen, not whatever it was
          // last showing — a tab can be left mid-stack by a one-off deep
          // link (e.g. Home's quick actions push straight into
          // mission/create), and footer taps should still mean "take me to
          // this tab's home", not "resume where I left off". navigate()
          // with a nested `screen` target pops back to an existing instance
          // of that screen instead of pushing a duplicate, so this both
          // switches tabs and resets the nested stack in one action. "home"
          // has no nested Stack, so it navigates directly.
          if (route.name === "home") {
            navigation.navigate("home");
          } else {
            navigation.navigate(route.name, { screen: "index" });
          }
        };

        return (
          <Pressable key={route.key} onPress={onPress} hitSlop={8}>
            {isFocused ? (
              <View style={styles.activePill}>
                <Ionicons name={meta.focused} size={18} color="#FFFFFF" />
                <Text style={styles.activePillLabel}>{tabLabels[route.name]}</Text>
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
      <Tabs.Screen name="mission" options={{ title: t("tabs.mission") }} />
      <Tabs.Screen name="voucher" options={{ title: t("tabs.voucher") }} />
      <Tabs.Screen name="account" options={{ title: t("tabs.account") }} />
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
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.75),
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.75),
  },
  activePillLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
