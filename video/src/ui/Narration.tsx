import { Audio } from "@remotion/media";
import { staticFile } from "remotion";
import type { VoRef } from "../data";

/** 장면 내레이션 (파일이 없으면 자막만) */
export const Narration: React.FC<{ vo: VoRef; delay: number }> = ({ vo, delay }) =>
  vo ? <Audio name="Narration" src={staticFile(vo.file)} from={delay} durationInFrames={vo.frames} /> : null;
