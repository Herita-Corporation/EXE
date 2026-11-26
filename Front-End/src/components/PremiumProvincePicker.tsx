import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";
import type { PremiumProvince } from "@/types/premium";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
}

export function PremiumProvincePicker<T extends PremiumProvince>({
  provinces,
  selected,
  onSelect,
}: {
  provinces: T[];
  selected?: T;
  onSelect: (province: T) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = provinces.filter((province) => normalize(province.name).includes(normalize(query)));

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.header}
      >
        <Ionicons name="location-outline" size={21} color={colors.navy} />
        <Text style={styles.heading}>{selected?.name ?? t("premium.chooseProvince")}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.navy} />
      </Pressable>
      {open && (
        <>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t("premium.searchProvince")}
            accessibilityLabel={t("premium.searchProvince")}
            icon="search-outline"
          />
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {matches.length ? matches.map((province) => (
              <Pressable
                key={province.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selected?.id === province.id }}
                style={({ pressed }) => [styles.option, (pressed || selected?.id === province.id) && styles.selected]}
                onPress={() => {
                  onSelect(province);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Text style={styles.optionLabel}>{province.name}</Text>
                {selected?.id === province.id && <Ionicons name="checkmark" size={18} color={colors.navy} />}
              </Pressable>
            )) : <Text style={styles.empty}>{t("premium.noProvinces")}</Text>}
          </ScrollView>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(1), paddingVertical: spacing(1.25) },
  header: { flexDirection: "row", alignItems: "center", gap: spacing(1), minHeight: 34 },
  heading: { flex: 1, color: colors.navy, fontSize: 16, fontWeight: "700" },
  list: { maxHeight: 280 },
  option: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(1),
    borderRadius: radius.sm,
  },
  selected: { backgroundColor: colors.blueSoft },
  optionLabel: { color: colors.text, fontSize: 14 },
  empty: { color: colors.textMuted, padding: spacing(1) },
});
