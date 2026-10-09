import * as Haptics from "expo-haptics";

// Fire-and-forget wrappers — haptics are a nicety, so a device without a
// taptic engine (or the web build) must never surface an error.
export const haptics = {
  /** Light tick — tab switches, selection changes, shutter press. */
  tap() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Something was earned/confirmed — mission accepted, voucher redeemed. */
  success() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** A destructive or failed action. */
  warning() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
