import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientHero } from "@/components/GradientHero";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

export function PremiumBenefits() {
  const benefits = [
    { icon: "flag-outline", title: "Nhiệm vụ đặc biệt", body: "Khám phá thêm nhiều trải nghiệm địa phương." },
    { icon: "people-outline", title: "Nhiệm vụ nhóm", body: "Hoàn thành hành trình cùng bạn đồng hành." },
    { icon: "ticket-outline", title: "Voucher ưu đãi", body: "Nhận phần thưởng sau khi hoàn thành nhiệm vụ." },
  ] as const;

  return (
    <View style={styles.benefits}>
      {benefits.map((benefit) => (
        <View key={benefit.icon} style={styles.benefit}>
          <Ionicons name={benefit.icon} size={20} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.benefitTitle}>{benefit.title}</Text>
            <Text style={styles.benefitBody}>{benefit.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function PremiumHomeCard() {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}
      onPress={() => router.push("/(tabs)/mission/premium/plans")}
    >
      <GradientHero style={styles.card} markPosition="top-right" markStyle={styles.mark}>
        <View style={styles.icon}><Ionicons name="diamond-outline" size={18} color={colors.onAmber} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>DISA Premium</Text>
          <Text style={styles.subtitle}>Mở khóa hành trình và ưu đãi đặc biệt</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gold} />
      </GradientHero>
    </Pressable>
  );
}

/** Ditan's mission entry treatment, kept independent of checkout/pricing UI. */
export function PremiumMissionEntries() {
  const { status } = usePremiumAccess();
  const { t } = useLocale();
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
          <Text style={styles.missionEntrySubtitle}>{t(unlocked ? "premium.specialByProvince" : "premium.specialLocked")}</Text>
        </View>
        <Ionicons name={unlocked ? "chevron-forward" : "lock-closed-outline"} size={18} color={colors.textMuted} />
      </Pressable>
      {unlocked ? (
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
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing(1), padding: spacing(1.5) },
  mark: { width: 110, opacity: 0.08 },
  icon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold },
  title: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 2 },
  benefits: { gap: spacing(1.25) },
  benefit: { flexDirection: "row", gap: spacing(1), alignItems: "flex-start" },
  benefitTitle: { color: colors.navy, fontSize: 14, fontWeight: "700" },
  benefitBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  missionEntries: { gap: spacing(1) },
  missionEntry: { flexDirection: "row", alignItems: "center", minHeight: 54, padding: spacing(1.25), gap: spacing(1), borderRadius: radius.md, backgroundColor: colors.blueSoft },
  missionEntryCopy: { flex: 1 },
  missionEntryText: { color: colors.navy, fontSize: 15, fontWeight: "700" },
  missionEntrySubtitle: { color: colors.textMuted, fontSize: 13 },
  pressed: { opacity: 0.78 },
});
