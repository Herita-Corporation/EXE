import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { BackHeader } from "@/components/BackHeader";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

const SECTIONS_EN = [
  {
    title: "1. What We Collect",
    body: "Account details (username, email, phone number), mission evidence (photos/videos you submit), itinerary preferences, and location when you grant permission for mission or itinerary features.",
  },
  {
    title: "2. How We Use It",
    body: "To run your account, generate itineraries, verify mission submissions, show your rewards and collection, and improve the app's features.",
  },
  {
    title: "3. AI Processing",
    body: "Itinerary text is generated using a third-party AI model. Your trip preferences (destinations, dates, budget) are sent to that provider to produce the itinerary — no photos or personal identifiers are included in that request.",
  },
  {
    title: "4. Storage",
    body: "Photos/videos you submit as mission evidence and event/avatar images are stored on DISA Travel's own servers, not shared with third parties beyond what's needed to operate the app.",
  },
  {
    title: "5. Your Choices",
    body: "You can update your profile, change your password, or contact support to request account or data deletion.",
  },
  {
    title: "6. Contact",
    body: "Questions about this policy can be directed to the app's support contact in Settings.",
  },
];

const SECTIONS_VI = [
  {
    title: "1. Chúng tôi thu thập gì",
    body: "Thông tin tài khoản (tên đăng nhập, email, số điện thoại), minh chứng nhiệm vụ (ảnh/video bạn gửi), sở thích lộ trình, và vị trí khi bạn cấp quyền cho các tính năng nhiệm vụ hoặc lộ trình.",
  },
  {
    title: "2. Chúng tôi sử dụng như thế nào",
    body: "Để vận hành tài khoản của bạn, tạo lộ trình, xác minh minh chứng nhiệm vụ, hiển thị phần thưởng và bộ sưu tập của bạn, và cải thiện các tính năng của ứng dụng.",
  },
  {
    title: "3. Xử lý bằng AI",
    body: "Nội dung lộ trình được tạo bằng mô hình AI của bên thứ ba. Sở thích chuyến đi của bạn (điểm đến, ngày, ngân sách) được gửi tới nhà cung cấp đó để tạo lộ trình — không có ảnh hay thông tin định danh cá nhân nào được gửi kèm.",
  },
  {
    title: "4. Lưu trữ",
    body: "Ảnh/video minh chứng nhiệm vụ và ảnh sự kiện/đại diện được lưu trên máy chủ riêng của DISA Travel, không chia sẻ cho bên thứ ba ngoài phạm vi cần thiết để vận hành ứng dụng.",
  },
  {
    title: "5. Lựa chọn của bạn",
    body: "Bạn có thể cập nhật hồ sơ, đổi mật khẩu, hoặc liên hệ hỗ trợ để yêu cầu xóa tài khoản hoặc dữ liệu.",
  },
  {
    title: "6. Liên hệ",
    body: "Mọi thắc mắc về chính sách này có thể gửi qua mục liên hệ hỗ trợ trong Cài đặt.",
  },
];

export default function PrivacyPolicyScreen() {
  const { t, locale } = useLocale();
  const sections = locale === "vi" ? SECTIONS_VI : SECTIONS_EN;

  return (
    <ScreenContainer scroll backgroundColor={colors.surface}>
      <BackHeader title={t("settings.privacyPolicy")} onBack={() => router.back()} />

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing(2), gap: spacing(0.5) },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  sectionBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
