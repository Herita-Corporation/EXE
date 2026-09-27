/**
 * Tracks whether this device has already seen the onboarding carousel, so
 * it only shows once (until the app is reinstalled / storage cleared).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "disa.onboardingSeen.v1";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, "true");
}
