import { create } from "qrcode";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneTiming } from "../data";
import { APP_URL, textOf } from "../data";
import { C, fontFamily, type Lang } from "../theme";
import { Narration } from "../ui/Narration";
import { Subtitle } from "../ui/Subtitle";

const QR = create(APP_URL, { errorCorrectionLevel: "M" });

const COPY: Record<Lang, { title: string; scan: string; notes: string[]; credit: string }> = {
  ko: {
    title: "대전 디투어",
    scan: "휴대폰 카메라로 QR을 스캔하세요",
    notes: [
      "소개된 가게와 제휴하지 않은 독립 안내 서비스이며, 공식 주문 서비스가 아닙니다.",
      "메뉴·가격은 현장 확인 전 예시값, 운영자 리포트 수치는 예시 데이터입니다.",
      "음성 인식 장면은 재현 장면입니다. 가게 로고·간판·사진은 쓰지 않았습니다.",
    ],
    credit: "내레이션: Microsoft Edge 음성(edge-tts) · 앱 화면: 데모 앱 자동 녹화",
  },
  en: {
    title: "Daejeon Detour",
    scan: "Scan the QR code with your phone camera",
    notes: [
      "An independent guide, not affiliated with the stores shown and not an official ordering service.",
      "Menus and prices are samples until verified on site. Operator report figures are sample data.",
      "The speech recognition scene is a reenactment. No store logos, signs or photos are used.",
    ],
    credit: "Narration: Kokoro TTS (Apache-2.0) · App screens: automated recording of the demo app",
  },
};

/** 마무리: 앱 이름 + QR(배포 URL) + 안내 문구(비제휴·예시값·예시 데이터·재현 장면) */
export const OutroScene: React.FC<{ timing: SceneTiming; lang: Lang }> = ({ timing, lang }) => {
  const t = textOf(timing.id);
  const c = COPY[lang];
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily, alignItems: "center" }}>
      <Card title={c.title} scan={c.scan} />
      <div style={{ position: "absolute", top: 1060, left: 90, right: 90, display: "flex", flexDirection: "column", gap: 14 }}>
        {c.notes.map((n) => (
          <div key={n} style={{ fontSize: 30, lineHeight: 1.4, color: C.sub, textAlign: "center", wordBreak: "keep-all" }}>
            {n}
          </div>
        ))}
        <div style={{ fontSize: 24, color: C.sub, opacity: 0.85, textAlign: "center", marginTop: 8 }}>{c.credit}</div>
      </div>
      <Subtitle text={t[lang]} from={timing.voDelayFrames} to={timing.durationInFrames} />
      <Narration vo={timing.vo[lang]} delay={timing.voDelayFrames} />
    </AbsoluteFill>
  );
};

const Card: React.FC<{ title: string; scan: string }> = ({ title, scan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = QR.modules.size;
  const cell = 480 / (n + 8);
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (QR.modules.get(y, x)) // BitMatrix.get(row, col): 행=y, 열=x
        cells.push(<rect key={`${x}-${y}`} x={(x + 4) * cell} y={(y + 4) * cell} width={cell + 0.5} height={cell + 0.5} fill={C.ink} />);
  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 26,
        opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" }),
        scale: interpolate(frame, [0, 0.6 * fps], [0.96, 1], { extrapolateRight: "clamp" }),
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 900, color: C.ink, letterSpacing: -1 }}>{title}</div>
      <svg width={480} height={480} style={{ background: "#fff", borderRadius: 36, boxShadow: "0 20px 60px rgba(40,30,10,0.18)" }}>
        {cells}
      </svg>
      <div style={{ fontSize: 40, fontWeight: 700, color: C.teal }}>{APP_URL.replace("https://", "")}</div>
      <div style={{ fontSize: 36, color: C.sub }}>{scan}</div>
    </div>
  );
};
