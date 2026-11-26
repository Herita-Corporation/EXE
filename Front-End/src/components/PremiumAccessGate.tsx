import React from "react";
import { ActivityIndicator } from "react-native";
import { Redirect, router } from "expo-router";
import { BackHeader } from "@/components/BackHeader";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ScreenContainer } from "@/components/ScreenContainer";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { useLocale } from "@/i18n/LocaleContext";
import { colors } from "@/theme/colors";

export function PremiumAccessGate({ children, from }: { children: React.ReactNode; from?: "special" }) {
  const { status, refresh } = usePremiumAccess();
  const { t } = useLocale();
  const plans = { pathname: "/(tabs)/mission/premium/plans", params: { from } } as const;

  if (status === "active") return children;
  if (status === "inactive") {
    return <Redirect href={plans} />;
  }

  return (
    <ScreenContainer>
      <BackHeader title={t("premium.title")} onBack={() => router.back()} />
      {status === "loading" ? <ActivityIndicator color={colors.navy} /> : (
        <>
          <ErrorBanner message={t("premium.subscriptionUnavailable")} />
          {from === "special" && <Button title={t("premium.viewPlans")} onPress={() => router.replace(plans)} />}
          <Button title={t("premium.retry")} variant="outline" onPress={refresh} />
        </>
      )}
    </ScreenContainer>
  );
}
