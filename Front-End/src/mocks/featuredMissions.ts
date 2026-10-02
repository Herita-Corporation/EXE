// MOCK — illustrative missions shown on Home ("Featured missions") and on the
// Mission tab when the user has no active missions yet. Real missions only
// exist once an itinerary is generated and its missions are assigned
// (mission/itinerary/[id].tsx → assignMission), so these cards route the user
// into that flow instead of pretending to be assignable on their own.
// Photos are real shots of each landmark, bundled from Wikimedia Commons
// (src/assets/images/missions/). Most are CC BY-SA, which requires credit —
// `credit` records the attribution (not shown on the card).

import type { ImageSourcePropType } from "react-native";
import type { Ionicons } from "@expo/vector-icons";

export type FeaturedMissionKind = "photo" | "video" | "checkin";

export interface FeaturedMission {
  id: string;
  title: string;
  place: string;
  kind: FeaturedMissionKind;
  rewardXP: number;
  rewardCoins: number;
  difficulty: 1 | 2 | 3;
  image: ImageSourcePropType;
  /** Photo attribution: "Author · License". */
  credit: string;
}

export const FEATURED_MISSION_KIND: Record<
  FeaturedMissionKind,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  photo: { label: "Chụp ảnh", icon: "camera-outline" },
  video: { label: "Quay video", icon: "videocam-outline" },
  checkin: { label: "Check-in", icon: "location-outline" },
};

export const FEATURED_MISSIONS: FeaturedMission[] = [
  {
    id: "fm-1",
    title: "Bình minh bên Hồ Gươm",
    place: "Hà Nội",
    kind: "photo",
    rewardXP: 120,
    rewardCoins: 30,
    difficulty: 1,
    image: require("@/assets/images/missions/ho-guom.jpg"),
    credit: "Cyril Doussin · CC BY-SA 2.0",
  },
  {
    id: "fm-2",
    title: "Thả đèn hoa đăng phố cổ",
    place: "Hội An",
    kind: "video",
    rewardXP: 200,
    rewardCoins: 50,
    difficulty: 2,
    image: require("@/assets/images/missions/hoi-an-den-hoa-dang.jpg"),
    credit: "Alexkom000 · CC BY 4.0",
  },
  {
    id: "fm-3",
    title: "Check-in Cầu Vàng",
    place: "Bà Nà, Đà Nẵng",
    kind: "checkin",
    rewardXP: 150,
    rewardCoins: 40,
    difficulty: 1,
    image: require("@/assets/images/missions/cau-vang.jpg"),
    credit: "DvTor8303 · CC0",
  },
  {
    id: "fm-4",
    title: "Chợ nổi lúc rạng đông",
    place: "Cái Răng, Cần Thơ",
    kind: "video",
    rewardXP: 250,
    rewardCoins: 60,
    difficulty: 3,
    image: require("@/assets/images/missions/cho-noi-cai-rang.jpg"),
    credit: "Jean-Marc Astesana · CC BY-SA 2.0",
  },
  {
    id: "fm-5",
    title: "Chinh phục đỉnh Fansipan",
    place: "Sa Pa, Lào Cai",
    kind: "photo",
    rewardXP: 400,
    rewardCoins: 100,
    difficulty: 3,
    image: require("@/assets/images/missions/fansipan.jpg"),
    credit: "Isderion · CC BY-SA 3.0 DE",
  },
];
