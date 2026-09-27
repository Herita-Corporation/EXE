import Constants from "expo-constants";
import { registerPushToken } from "@/api/endpoints/auth";

// Expo Go eagerly requires every screen in the route tree at boot (to build
// its navigation table), so a top-level `import ... from "expo-notifications"`
// anywhere in the app crashes the ENTIRE app on launch in Expo Go — that
// package's remote-push code throws just from being imported there (removed
// from Expo Go since SDK 53, dev build required). Requiring it lazily inside
// this function body means Metro only evaluates it when actually called
// (i.e. never, while running in Expo Go — see the early return below).
const isExpoGo = Constants.appOwnership === "expo";

/**
 * Requests notification permission, fetches this device's Expo push token,
 * and registers it with IAMService (POST /api/auth/push-token). Returns
 * true on success — callers use this to reflect an enabled/disabled toggle.
 */
export async function enablePushNotifications(): Promise<boolean> {
  if (isExpoGo) {
    return false;
  }

  const Notifications = require("expo-notifications");
  const Device = require("expo-device");
  const { Platform } = require("react-native");

  if (!Device.isDevice) {
    // Push tokens aren't available on simulators/emulators.
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  await registerPushToken({ pushToken: tokenResponse.data });
  return true;
}
