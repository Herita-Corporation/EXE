import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { PartnerOfferCard } from "@/components/PartnerOfferCard";
import { getDestinationPartnerOffers } from "@/data/partnerOffers";
import { spacing } from "@/theme/colors";

export function PartnerRecommendations({
  destinations,
  style,
}: {
  destinations: readonly string[];
  style?: ViewStyle;
}) {
  const offers = getDestinationPartnerOffers(destinations);
  if (offers.length === 0) return null;

  return (
    <View style={[styles.list, style]}>
      {offers.map((offer) => <PartnerOfferCard key={offer.partnerId} offer={offer} compact />)}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing(1.25) },
});
