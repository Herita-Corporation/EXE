/**
 * Hand-off for a photo/video captured on mission/camera.tsx or
 * mission/record.tsx back to whichever mission-detail screen pushed it.
 * expo-router has no built-in "return value" mechanism between screens, so
 * we use tiny in-memory singletons — no need for AsyncStorage since this
 * only has to survive one same-process navigation (capture screen ->
 * router.back() -> detail screen's focus effect).
 */
let pendingPhotoUri: string | null = null;

export function setPendingCapturedPhoto(uri: string): void {
  pendingPhotoUri = uri;
}

export function consumePendingCapturedPhoto(): string | null {
  const uri = pendingPhotoUri;
  pendingPhotoUri = null;
  return uri;
}

let pendingVideo: { uri: string; durationSec: number } | null = null;

export function setPendingCapturedVideo(uri: string, durationSec: number): void {
  pendingVideo = { uri, durationSec };
}

export function consumePendingCapturedVideo(): { uri: string; durationSec: number } | null {
  const video = pendingVideo;
  pendingVideo = null;
  return video;
}
