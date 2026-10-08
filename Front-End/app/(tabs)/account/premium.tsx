import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useIAP } from "react-native-iap";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useLocale } from "@/i18n/LocaleContext";
import * as premiumApi from "@/api/endpoints/premium";
import { ApiError } from "@/api/http";
import { colors, spacing } from "@/theme/colors";

// Must match the Subscription product id created in Play Console (Monetize ->
// Products -> Subscriptions) and the backend's GooglePlayBillingService calls.
const PREMIUM_SKU = "premium_monthly";

export default function PremiumScreen() {
  const { user, refreshMe } = useAuth();
  const { showToast } = useToast();
  const { t } = useLocale();
  const [verifying, setVerifying] = useState(false);

  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (!purchase.purchaseToken) return;
      setVerifying(true);
      try {
        await premiumApi.verifyPurchase({
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken,
        });
        await finishTransaction({ purchase, isConsumable: false });
        await refreshMe();
        showToast(t("premium.upgradeSuccess"), "success");
        router.back();
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : t("premium.verifyFailed"), "error");
      } finally {
        setVerifying(false);
      }
    },
    onPurchaseError: (error) => {
      showToast(error.message || t("premium.purchaseFailed"), "error");
    },
  });

  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [PREMIUM_SKU], type: "subs" }).catch(() => {});
  }, [connected, fetchProducts]);

  const plan = subscriptions.find((s) => s.id === PREMIUM_SKU);
  const offer =
    plan && "subscriptionOffers" in plan ? plan.subscriptionOffers?.[0] : undefined;

  async function onUpgrade() {
    if (!offer) return;
    try {
      await requestPurchase({
        type: "subs",
        request: {
          google: {
            skus: [PREMIUM_SKU],
            subscriptionOffers: [
              { sku: PREMIUM_SKU, offerToken: offer.offerTokenAndroid ?? "" },
            ],
          },
        },
      });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t("premium.purchaseFailed"), "error");
    }
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("premium.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {user?.isPremium ? (
        <Card style={styles.card}>
          <Text style={styles.description}>{t("premium.alreadyPremium")}</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <Text style={styles.planName}>{plan?.title ?? PREMIUM_SKU}</Text>
            <Text style={styles.planPrice}>
              {plan?.displayPrice ?? t("premium.loadingPlan")}
            </Text>
            <Text style={styles.description}>{t("premium.description")}</Text>
          </Card>

          <Button
            title={t("premium.upgradeButton")}
            onPress={onUpgrade}
            loading={verifying}
            disabled={!connected || !offer}
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700", color: colors.navy },
  card: { gap: spacing(1), marginTop: spacing(2) },
  planName: { fontSize: 18, fontWeight: "800", color: colors.text },
  planPrice: { fontSize: 22, fontWeight: "800", color: colors.navy },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
