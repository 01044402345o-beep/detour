import { loadFont } from "@remotion/google-fonts/NotoSansKR";

// 앱(목업) 색과 맞춘 영상 색. 가게 로고·간판·사진은 쓰지 않습니다(PRD 4장·리스크 표).
export const C = {
  bg: "#F6EFE3",
  ink: "#17181C",
  sub: "#5B5E66",
  accent: "#B8461B",
  teal: "#127C72",
  line: "#E4D9C6",
  card: "#FFFFFF",
  bezel: "#1B1C21",
} as const;

export const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"] });

export type Lang = "ko" | "en";
