import React, { useState } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { PaginationDots } from "@/components/PaginationDots";
import { PartnerOfferBanner } from "@/components/PartnerOfferBanner";
import type { PartnerOffer } from "@/data/partnerOffers";
import { useLocale } from "@/i18n/LocaleContext";
import { radius, spacing } from "@/theme/colors";

export function PartnerOfferCarousel({ offers }: { offers: readonly PartnerOffer[] }) {
  const { t } = useLocale();
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  if (offers.length === 0) return null;
  const visibleIndex = Math.min(activeIndex, offers.length - 1);

  function onScroll({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement } = nativeEvent;
    if (layoutMeasurement.width <= 0) return;

    const index = Math.round(contentOffset.x / layoutMeasurement.width);
    setActiveIndex(Math.max(0, Math.min(index, offers.length - 1)));
  }

  return (
    <View style={styles.carousel}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.pages}
        onLayout={({ nativeEvent }) => setPageWidth(nativeEvent.layout.width)}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {pageWidth > 0 && offers.map((offer) => (
          <View key={offer.partnerId} style={{ width: pageWidth }}>
            <PartnerOfferBanner offer={offer} />
          </View>
        ))}
      </ScrollView>

      {offers.length > 1 && (
        <PaginationDots
          count={offers.length}
          activeIndex={visibleIndex}
          onLightBackground
          accessibilityLabel={t("partnerOffer.carouselPosition", { current: visibleIndex + 1, count: offers.length })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: { gap: spacing(1) },
  pages: { flexGrow: 0, borderRadius: radius.lg },
});
