import { Composition } from "remotion";
import { TIMELINE } from "./data";
import { DetourDemo } from "./DetourDemo";

export const RemotionRoot: React.FC = () => (
  <>
    {/* 한국어 자막 + 한국어 내레이션(edge-tts) — 기본 */}
    <Composition
      id="DetourDemoKo"
      component={DetourDemo}
      durationInFrames={TIMELINE.durationInFrames}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ lang: "ko" as const }}
    />
    {/* 영어 자막 + 영어 내레이션(Kokoro) */}
    <Composition
      id="DetourDemoEn"
      component={DetourDemo}
      durationInFrames={TIMELINE.durationInFrames}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ lang: "en" as const }}
    />
  </>
);
