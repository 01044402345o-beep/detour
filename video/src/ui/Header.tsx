import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fontFamily } from "../theme";

/** 장면 제목(위) + 표기 배지(예시값·재현 장면·예시 데이터) */
export const Header: React.FC<{ step: string; badge?: string; tone?: "warn" | "info" }> = ({ step, badge, tone = "info" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 80,
        right: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        fontFamily,
        opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], { extrapolateRight: "clamp" }),
        translate: interpolate(frame, [0, 0.4 * fps], ["0px 16px", "0px 0px"], { extrapolateRight: "clamp" }),
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 900, color: C.ink, letterSpacing: -0.5, textAlign: "center", whiteSpace: "nowrap" }}>{step}</div>
      {badge ? (
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            padding: "10px 26px",
            borderRadius: 999,
            color: tone === "warn" ? C.accent : C.teal,
            background: tone === "warn" ? "#FBE3D6" : "#D9F0EC",
            border: `2px solid ${tone === "warn" ? "#EDB79C" : "#9FD5CC"}`,
            textAlign: "center",
          }}
        >
          {badge}
        </div>
      ) : null}
    </div>
  );
};
