import app from "./app.json";

const directApk = process.env.APP_VARIANT === "direct-apk";

export default {
  ...app.expo,
  // Native Google Sign-In replaces the browser redirect flow for signed
  // Android builds. The plugin is harmless for Android and supplies the
  // native module required by EAS builds.
  plugins: [...app.expo.plugins, "@react-native-google-signin/google-signin"],
  android: {
    ...app.expo.android,
    // The direct APK has its own Android identity so it can coexist with the
    // Play build even though each uses a different signing certificate.
    package: directApk ? "com.disa.travel.frontend.direct" : "com.disa.travel.frontend",
  },
};
