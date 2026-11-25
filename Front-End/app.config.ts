import app from "./app.json";

const directApk = process.env.APP_VARIANT === "direct-apk";

export default {
  ...app.expo,
  android: {
    ...app.expo.android,
    // The direct APK has its own Android identity so it can coexist with the
    // Play build even though each uses a different signing certificate.
    package: directApk ? "com.disa.travel.frontend.direct" : "com.disa.travel.frontend",
  },
};
