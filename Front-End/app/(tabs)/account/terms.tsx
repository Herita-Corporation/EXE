import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, spacing } from "@/theme/colors";

const SECTIONS_EN = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account or using DISA Travel, you agree to these Terms of Service. If you do not agree, please do not use the app.",
  },
  {
    title: "2. Your Account",
    body: "You are responsible for keeping your login credentials secure and for all activity under your account. Notify us immediately if you suspect unauthorized access.",
  },
  {
    title: "3. Itineraries & AI Content",
    body: "Itinerary suggestions are generated with AI assistance and may contain inaccuracies. Always verify opening hours, prices, and travel conditions independently before you rely on them.",
  },
  {
    title: "4. Missions & Rewards",
    body: "XP, coins, and vouchers earned in the app have no real-world monetary value outside the app and may be adjusted or reset if fraudulent activity is detected.",
  },
  {
    title: "5. User Content",
    body: "Photos and videos you submit as mission evidence remain yours, but you grant DISA Travel a license to store and display them within the app (e.g. your Collection).",
  },
  {
    title: "6. Changes",
    body: "We may update these terms as the app evolves. Continued use after a change means you accept the updated terms.",
  },
];

const SECTIONS_VI = [
  {
    title: "1. Chấp nhận điều khoản",
    body: "Khi tạo tài khoản hoặc sử dụng DISA Travel, bạn đồng ý với các Điều khoản dịch vụ này. Nếu không đồng ý, vui lòng không sử dụng ứng dụng.",
  },
  {
    title: "2. Tài khoản của bạn",
    body: "Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động diễn ra dưới tài khoản của mình. Hãy báo ngay nếu nghi ngờ có truy cập trái phép.",
  },
  {
    title: "3. Lộ trình & Nội dung AI",
    body: "Gợi ý lộ trình được tạo với sự hỗ trợ của AI và có thể chứa sai sót. Luôn tự kiểm tra giờ mở cửa, giá cả và điều kiện di chuyển trước khi tin tưởng hoàn toàn.",
  },
  {
    title: "4. Nhiệm vụ & Phần thưởng",
    body: "XP, Coin và voucher nhận được trong ứng dụng không có giá trị quy đổi tiền mặt ngoài đời thực và có thể bị điều chỉnh hoặc thu hồi nếu phát hiện gian lận.",
  },
  {
    title: "5. Nội dung do người dùng tạo",
    body: "Ảnh và video bạn gửi làm minh chứng nhiệm vụ vẫn thuộc về bạn, nhưng bạn cấp cho DISA Travel quyền lưu trữ và hiển thị chúng trong ứng dụng (vd: mục Bộ sưu tập).",
  },
  {
    title: "6. Thay đổi",
    body: "Chúng tôi có thể cập nhật điều khoản này khi ứng dụng phát triển. Việc tiếp tục sử dụng sau khi có thay đổi đồng nghĩa bạn chấp nhận điều khoản mới.",
  },
];

export default function TermsOfServiceScreen() {
  const { t, locale } = useLocale();
  const sections = locale === "vi" ? SECTIONS_VI : SECTIONS_EN;

  return (
    <ScreenContainer scroll backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("settings.termsOfService")}</Text>
        <View style={{ width: 40 }} />
      </View>

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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  section: { marginTop: spacing(2), gap: spacing(0.5) },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  sectionBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
