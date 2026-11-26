import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { en, Translations, vi } from "./translations";

export type Locale = "en" | "vi";

const DICTIONARIES: Record<Locale, Translations> = { en, vi };
const STORAGE_KEY = "disa.locale.v1";

type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DotPaths<Translations> | string;

// UI components imported from the premium UI refresh can be rolled out before
// their copy is consolidated into the legacy translation catalogue.  Keep the
// fallback text here so users never see a raw translation key during that
// transition.
const UI_COPY: Record<Locale, Record<string, string>> = {
  en: {
    "premium.title": "Premium", "premium.subscriptionUnavailable": "Premium access is temporarily unavailable.", "premium.viewPlans": "View plans", "premium.retry": "Try again", "premium.photo": "Photo", "premium.video": "Video", "premium.completed": "Completed", "premium.accepted": "Accepted", "premium.chooseProvince": "Choose a province/city", "premium.searchProvince": "Search province/city", "premium.noProvinces": "No matching province/city.", "premium.pickFailed": "Could not choose the file. Please try again.", "premium.videoSelected": "Video selected", "premium.pickVideo": "Choose video", "premium.voucherPeriod": "Valid {start} – {end}", "premium.voucherEnds": "Valid until {date}", "premium.voucherStarts": "Valid from {date}", "premium.providerPeriod": "See partner terms for validity.", "premium.personalVoucher": "Your voucher", "premium.sharedVoucher": "Group voucher", "premium.publicOffer": "Partner offer", "premium.pointCost": "{count} points", "premium.voucherCode": "Code: {code}", "premium.terms": "Terms and conditions", "premium.groupVoucherUse": "Available to group members.", "premium.upcomingVoucher": "This offer is not available yet.", "premium.useVoucher": "Use voucher",
    "partnerOffer.viewPartnerVouchers": "View partner offers", "partnerOffer.viewVoucher": "View offer", "partnerOffer.soldOut": "Currently unavailable", "partnerOffer.onWebsite": "Available on partner website", "partnerOffer.bookOnBooking": "Open partner website", "partnerOffer.destinationSuggestion": "Recommended offer", "partnerOffer.carouselPosition": "Offer {current} of {count}", "partnerOffer.expired": "This offer has expired.", "partnerOffer.redeem": "Open offer", "partnerOffer.openFailed": "Could not open the partner link.", "voucher.redeemShort": "Redeem",
  },
  vi: {
    "premium.title": "Premium", "premium.subscriptionUnavailable": "Không thể kiểm tra quyền Premium lúc này.", "premium.viewPlans": "Xem gói", "premium.retry": "Thử lại", "premium.photo": "Ảnh", "premium.video": "Video", "premium.completed": "Đã hoàn thành", "premium.accepted": "Đã nhận", "premium.chooseProvince": "Chọn tỉnh/thành", "premium.searchProvince": "Tìm tỉnh/thành", "premium.noProvinces": "Không tìm thấy tỉnh/thành phù hợp.", "premium.pickFailed": "Không thể chọn tệp. Vui lòng thử lại.", "premium.videoSelected": "Đã chọn video", "premium.pickVideo": "Chọn video", "premium.voucherPeriod": "Hiệu lực {start} – {end}", "premium.voucherEnds": "Hiệu lực đến {date}", "premium.voucherStarts": "Hiệu lực từ {date}", "premium.providerPeriod": "Xem thời hạn trong điều khoản của đối tác.", "premium.personalVoucher": "Voucher của bạn", "premium.sharedVoucher": "Voucher nhóm", "premium.publicOffer": "Ưu đãi đối tác", "premium.pointCost": "{count} điểm", "premium.voucherCode": "Mã: {code}", "premium.terms": "Điều khoản sử dụng", "premium.groupVoucherUse": "Áp dụng cho thành viên nhóm.", "premium.upcomingVoucher": "Ưu đãi chưa có hiệu lực.", "premium.useVoucher": "Dùng voucher",
    "partnerOffer.viewPartnerVouchers": "Xem ưu đãi đối tác", "partnerOffer.viewVoucher": "Xem ưu đãi", "partnerOffer.soldOut": "Tạm hết ưu đãi", "partnerOffer.onWebsite": "Áp dụng trên website đối tác", "partnerOffer.bookOnBooking": "Mở website đối tác", "partnerOffer.destinationSuggestion": "Ưu đãi gợi ý", "partnerOffer.carouselPosition": "Ưu đãi {current} trên {count}", "partnerOffer.expired": "Ưu đãi đã hết hạn.", "partnerOffer.redeem": "Mở ưu đãi", "partnerOffer.openFailed": "Không thể mở liên kết đối tác.", "voucher.redeemShort": "Đổi ưu đãi",
  },
};

function resolve(dict: Translations, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], dict);
  return typeof value === "string" ? value : key;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "en" || saved === "vi") setLocaleState(saved);
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let text = resolve(DICTIONARIES[locale], key);
      if (text === key) text = UI_COPY[locale][key] ?? key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replace(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
