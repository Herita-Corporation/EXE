export const premiumTestApiUrl = __DEV__ ? process.env.EXPO_PUBLIC_DISA_PREMIUM_TEST_API_URL : undefined;
export const isPremiumTest = !!premiumTestApiUrl;
