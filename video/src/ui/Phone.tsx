import { C } from "../theme";

/** 폰 프레임 (화면 390×844 비율). 앱 녹화 클립을 children으로 받습니다. */
export const SCREEN_W = 620;
export const SCREEN_H = Math.round((SCREEN_W * 844) / 390);
const BEZEL = 16;

export const Phone: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: (1080 - SCREEN_W - BEZEL * 2) / 2,
      width: SCREEN_W + BEZEL * 2,
      height: SCREEN_H + BEZEL * 2,
      borderRadius: 72,
      background: C.bezel,
      padding: BEZEL,
      boxShadow: "0 30px 80px rgba(40,30,10,0.22)",
    }}
  >
    <div style={{ position: "relative", width: SCREEN_W, height: SCREEN_H, borderRadius: 56, overflow: "hidden", background: "#fff" }}>
      {children}
    </div>
  </div>
);
