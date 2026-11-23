import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneTiming } from "../data";
import { textOf } from "../data";
import { C, fontFamily, type Lang } from "../theme";
import { Narration } from "../ui/Narration";
import { Subtitle } from "../ui/Subtitle";

const HEAD: Record<Lang, string> = { ko: "빵집 한 곳에서\n끝나는 여행", en: "A trip that ends\nat one bakery" };
const OTHERS: Record<Lang, string[]> = {
  ko: ["골목 상권", "근대 유적", "로컬 식당"],
  en: ["Alleys", "History", "Local food"],
};

/** 문제 제기: 코드로 그린 일러스트만 사용 — 실제 가게 로고·간판·사진 없음 */
export const ProblemScene: React.FC<{ timing: SceneTiming; lang: Lang }> = ({ timing, lang }) => {
  const t = textOf(timing.id);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Headline text={HEAD[lang]} />
      <Crowd labels={OTHERS[lang]} />
      <Subtitle text={t[lang]} from={timing.voDelayFrames} to={timing.durationInFrames} />
      <Narration vo={timing.vo[lang]} delay={timing.voDelayFrames} />
    </AbsoluteFill>
  );
};

const Headline: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 170,
        left: 80,
        right: 80,
        fontFamily,
        fontWeight: 900,
        fontSize: 92,
        lineHeight: 1.18,
        color: C.ink,
        whiteSpace: "pre-line",
        textAlign: "center",
        opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" }),
        translate: interpolate(frame, [0, 0.6 * fps], ["0px 24px", "0px 0px"], {
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      {text}
    </div>
  );
};

// 사람 점: 사방에서 가운데 빵집으로 모입니다. 위치는 결정적(난수 없음).
const DOTS = Array.from({ length: 34 }, (_, i) => {
  const a = (i * 137.5 * Math.PI) / 180;
  const r0 = 330 + (i % 5) * 26;
  const r1 = 95 + (i % 4) * 22;
  return { x0: Math.cos(a) * r0, y0: Math.sin(a) * r0 * 0.8, x1: Math.cos(a) * r1 * 1.7, y1: Math.sin(a) * r1 * 1.3, d: (i % 7) * 4 };
});
const STOPS = [
  { x: -330, y: -250 },
  { x: 340, y: -170 },
  { x: 290, y: 300 },
];

const Crowd: React.FC<{ labels: string[] }> = ({ labels }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cx = 540;
  const cy = 1030;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }} aria-hidden>
      {STOPS.map((s, i) => (
        <g key={labels[i]} opacity={0.55}>
          <line x1={cx} y1={cy} x2={cx + s.x} y2={cy + s.y} stroke={C.sub} strokeWidth={5} strokeDasharray="4 18" strokeLinecap="round" />
          <circle cx={cx + s.x} cy={cy + s.y} r={58} fill={C.card} stroke={C.line} strokeWidth={5} />
          <text x={cx + s.x} y={cy + s.y + 16} textAnchor="middle" fontFamily={fontFamily} fontWeight={900} fontSize={48} fill={C.sub}>
            ?
          </text>
          <text x={cx + s.x} y={cy + s.y + 104} textAnchor="middle" fontFamily={fontFamily} fontWeight={700} fontSize={38} fill={C.sub}>
            {labels[i]}
          </text>
        </g>
      ))}
      {/* 빵집 일러스트: 지붕 + 진열대 + 빵 */}
      <circle cx={cx} cy={cy} r={150} fill="#F7D9A8" />
      <path d={`M ${cx - 110} ${cy - 20} L ${cx} ${cy - 105} L ${cx + 110} ${cy - 20} Z`} fill={C.accent} />
      <rect x={cx - 85} y={cy - 22} width={170} height={110} rx={14} fill={C.card} />
      <ellipse cx={cx} cy={cy + 36} rx={58} ry={34} fill="#D99A4E" />
      <path d={`M ${cx - 30} ${cy + 26} q 10 -14 20 0 M ${cx + 2} ${cy + 26} q 10 -14 20 0`} stroke="#F6E2BF" strokeWidth={6} fill="none" strokeLinecap="round" />
      {DOTS.map((d, i) => {
        const p = interpolate(frame, [0.3 * fps + d.d, 2.6 * fps + d.d], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.33, 1, 0.68, 1),
        });
        return (
          <circle
            key={`dot-${d.x0.toFixed(2)}-${d.y0.toFixed(2)}`}
            cx={cx + d.x0 + (d.x1 - d.x0) * p}
            cy={cy + d.y0 + (d.y1 - d.y0) * p}
            r={15}
            fill={i % 3 === 0 ? C.teal : C.ink}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
};
