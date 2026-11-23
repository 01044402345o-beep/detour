import { AbsoluteFill, Sequence } from "remotion";
import { TIMELINE } from "./data";
import { ClipScene } from "./scenes/ClipScene";
import { OutroScene } from "./scenes/OutroScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { C, type Lang } from "./theme";

export type DetourDemoProps = { lang: Lang };

/**
 * 대전 디투어 시연 영상 (T2.7). 장면 순서·길이는 src/timeline.json(scripts/timeline.mjs가 생성)을 따릅니다.
 * 장면은 한 템플릿으로 관리하므로 timeline 순서대로 이어 붙입니다.
 */
export const DetourDemo: React.FC<DetourDemoProps> = ({ lang }) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    {TIMELINE.scenes.map((s) => (
      <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.durationInFrames}>
        {s.id === "s01_problem" ? (
          <ProblemScene timing={s} lang={lang} />
        ) : s.id === "s10_outro" ? (
          <OutroScene timing={s} lang={lang} />
        ) : (
          <ClipScene timing={s} lang={lang} />
        )}
      </Sequence>
    ))}
  </AbsoluteFill>
);
