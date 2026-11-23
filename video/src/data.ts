import narration from "./narration.json";
import timeline from "./timeline.json";
import type { Lang } from "./theme";

type Text = Record<Lang, string>;
export type SceneText = {
  id: string;
  clip: string | null;
  step: Text;
  badge?: Text;
  ko: string;
  en: string;
};
export type VoRef = { file: string; frames: number } | null;
export type SceneTiming = {
  id: string;
  clip: string | null;
  from: number;
  durationInFrames: number;
  clipFrames: number | null;
  voDelayFrames: number;
  vo: Record<Lang, VoRef>;
};

export const TIMELINE = timeline as {
  fps: number;
  durationInFrames: number;
  seconds: number;
  recordedCommit: string;
  hasVo: Record<Lang, boolean>;
  scenes: SceneTiming[];
};

const TEXT = new Map((narration.scenes as SceneText[]).map((s) => [s.id, s]));
export const textOf = (id: string): SceneText => {
  const t = TEXT.get(id);
  if (!t) throw new Error(`narration missing: ${id}`);
  return t;
};

export const APP_URL = "https://01044402345o-beep.github.io/detour/";
