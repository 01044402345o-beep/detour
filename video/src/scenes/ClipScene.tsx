import { Video } from "@remotion/media";
import { AbsoluteFill, Freeze, Sequence, staticFile } from "remotion";
import type { SceneTiming } from "../data";
import { textOf } from "../data";
import { C, type Lang } from "../theme";
import { Header } from "../ui/Header";
import { Narration } from "../ui/Narration";
import { Phone } from "../ui/Phone";
import { Subtitle } from "../ui/Subtitle";

/**
 * 앱 녹화 클립 장면: 위 장면 제목·표기 배지 / 가운데 폰 프레임 안 클립 / 아래 자막.
 * 내레이션이 클립보다 길면 클립 마지막 프레임을 멈춰 보여 줍니다.
 */
export const ClipScene: React.FC<{ timing: SceneTiming; lang: Lang }> = ({ timing, lang }) => {
  const t = textOf(timing.id);
  const src = staticFile(`clips/${timing.clip}.mp4`);
  const clipFrames = timing.clipFrames ?? timing.durationInFrames;
  const tone = timing.id === "s06_practice" ? "warn" : "info";
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Header step={t.step[lang]} badge={t.badge?.[lang]} tone={tone} />
      <Phone top={t.badge ? 262 : 212}>
        <Sequence name="App clip" durationInFrames={clipFrames} layout="none">
          <Video name={timing.clip ?? "clip"} src={src} muted style={{ width: "100%", height: "100%" }} />
        </Sequence>
        {timing.durationInFrames > clipFrames ? (
          <Sequence name="Hold last frame" from={clipFrames} layout="none">
            <Freeze frame={clipFrames - 1}>
              <Video src={src} muted style={{ width: "100%", height: "100%" }} />
            </Freeze>
          </Sequence>
        ) : null}
      </Phone>
      <Subtitle text={t[lang]} from={timing.voDelayFrames} to={timing.durationInFrames} />
      <Narration vo={timing.vo[lang]} delay={timing.voDelayFrames} />
    </AbsoluteFill>
  );
};
