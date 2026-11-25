import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientHero } from "@/components/GradientHero";
import premiumPlans from "@/data/premiumPlans.json";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

export function PremiumBenefits({ onDark = false }: { onDark?: boolean }) {
  const { t } = useLocale();
  const benefits = [
    { icon: "location-outline", title: t("premium.special"), description: t("premium.specialBenefit") },
    { icon: "ticket-outline", title: t("premium.instantVoucher"), description: t("premium.voucherBenefit") },
    { icon: "people-outline", title: t("premium.groups"), description: t("premium.groupBenefit") },
  ] as const;

  return (
    <View style={styles.benefits}>
      {benefits.map((benefit) => (
        <View key={benefit.icon} style={styles.benefit}>
          <View style={[styles.benefitIcon, onDark && styles.benefitIconOnDark]}>
            <Ionicons name={benefit.icon} size={20} color={onDark ? colors.gold : colors.navy} />
          </View>
          <View style={styles.benefitCopy}>
            <Text style={[styles.benefitTitle, onDark && styles.textOnDark]}>{benefit.title}</Text>
            <Text style={[styles.benefitText, onDark && styles.mutedOnDark]}>{benefit.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function PremiumHomeCard() {
  const { t } = useLocale();
  const monthlyPlan = premiumPlans.find((plan) => plan.periodMonths === 1);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}
      onPress={() => router.push({ pathname: "/(tabs)/mission/premium/plans", params: { from: "home" } })}
    >
      <GradientHero style={styles.homeCard} markPosition="top-right" markStyle={styles.homeMark}>
        <View style={styles.goldIcon}>
          <Ionicons name="diamond-outline" color={colors.onAmber} size={17} />
        </View>
        <View style={styles.homeCopy}>
          <Text style={styles.title}>{t("premium.title")}</Text>
          {monthlyPlan && (
            <Text style={styles.homePrice}>
              {t("premium.monthlyPrice", { price: `${monthlyPlan.priceVnd.toLocaleString("vi-VN")}đ` })}
            </Text>
          )}
        </View>
        <View style={styles.homeLink}>
          <Text style={styles.homeLinkText}>{t("premium.viewPlans")}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.gold} />
        </View>
      </GradientHero>
    </Pressable>
  );
}

export function PremiumMissionEntries() {
  const { t } = useLocale();
  const { status } = usePremiumAccess();
  const unlocked = status === "active";

  return (
    <View style={styles.missionEntries}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.missionEntry, pressed && styles.pressed]}
        onPress={() => router.push("/(tabs)/mission/premium/special")}
      >
        <Ionicons name="flag-outline" size={23} color={colors.navy} />
        <View style={styles.missionEntryCopy}>
          <Text style={styles.missionEntryText}>{t("premium.special")}</Text>
          <Text style={styles.missionEntrySubtitle}>
            {t(unlocked ? "premium.specialByProvince" : "premium.specialLocked")}
          </Text>
        </View>
        <Ionicons
          name={unlocked ? "chevron-forward" : "lock-closed-outline"}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      {unlocked && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.missionEntry, pressed && styles.pressed]}
          onPress={() => router.push("/(tabs)/mission/premium/groups")}
        >
          <Ionicons name="people-outline" size={23} color={colors.navy} />
          <View style={styles.missionEntryCopy}>
            <Text style={styles.missionEntryText}>{t("premium.groups")}</Text>
            <Text style={styles.missionEntrySubtitle}>{t("premium.groupCompletionRule")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  homeCard: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    borderWidth: 1,
    borderColor: "rgba(255,168,38,0.45)",
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    gap: spacing(1),
  },
  homeMark: { width: 112, opacity: 0.07 },
  homeCopy: { flex: 1, gap: spacing(0.25) },
  goldIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  title: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  homePrice: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  homeLink: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: spacing(0.5),
    paddingHorizontal: spacing(0.75),
    paddingVertical: spacing(0.75),
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.sm,
  },
  homeLinkText: { flexShrink: 1, fontSize: 12, fontWeight: "700", color: colors.gold },
  benefits: { gap: spacing(1.5) },
  benefit: { flexDirection: "row", alignItems: "flex-start", gap: spacing(1.25) },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitIconOnDark: { backgroundColor: "rgba(255,255,255,0.08)" },
  benefitCopy: { flex: 1, gap: spacing(0.25) },
  benefitTitle: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: colors.navy },
  benefitText: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  textOnDark: { color: "#FFFFFF" },
  mutedOnDark: { fontSize: 13, lineHeight: 19, color: "rgba(255,255,255,0.78)" },
  missionEntries: { gap: spacing(1) },
  missionEntry: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    padding: spacing(1.25),
    gap: spacing(1),
    borderRadius: radius.md,
    backgroundColor: colors.blueSoft,
  },
  missionEntryCopy: { flex: 1 },
  missionEntryText: { color: colors.navy, fontSize: 15, fontWeight: "700" },
  missionEntrySubtitle: { color: colors.textMuted, fontSize: 13 },
  pressed: { opacity: 0.7 },
});
