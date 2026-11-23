import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fontFamily } from "../theme";

/** 화면 아래 자막 (한 장면 = 한 문장). 1080폭 기준 본문 46px 이상. */
export const Subtitle: React.FC<{ text: string; from: number; to: number }> = ({ text, from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [from, from + 0.25 * fps, to - 0.2 * fps, to], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        bottom: 56,
        minHeight: 230,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily,
          fontWeight: 700,
          fontSize: 46,
          lineHeight: 1.38,
          color: C.ink,
          textAlign: "center",
          wordBreak: "keep-all",
          textWrap: "balance",
        }}
      >
        {text}
      </p>
    </div>
  );
};
