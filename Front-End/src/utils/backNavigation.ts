import { router, useLocalSearchParams } from "expo-router";

// Screens reachable by jumping straight from Home into another tab's
// sub-screen (e.g. Home's "Create Itinerary" quick action -> mission/create)
// get pushed into that tab's own Stack, which synthesizes its root screen
// underneath them for normal in-stack back behavior. That means a plain
// router.back() lands on that tab's root instead of back on Home — the
// cross-tab jump itself isn't undoable via the Stack's own history.
// Entry points that jump tabs tag the href with `?from=home`; screens that
// can be reached that way call this instead of router.back() so the button
// honors where the user actually came from.
export function useSmartBack() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return () => {
    if (from === "home") {
      router.replace("/(tabs)/home");
    } else {
      router.back();
    }
  };
}
