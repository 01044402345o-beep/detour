#!/usr/bin/env node
/**
 * 장면 길이 계산 → src/timeline.json
 * - 클립 길이(public/clips/clips.json)와 내레이션 길이(public/vo/{ko,en}/, ffprobe로 측정) 중 긴 쪽에 맞춥니다.
 * - 한국어판·영어판이 같은 장면 길이를 쓰도록 두 언어 중 긴 내레이션을 기준으로 합니다.
 * - 내레이션 파일이 없으면 hasVo=false로 기록하고 자막만으로 렌더합니다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const VO_LEAD = 0.4; // 장면 시작 후 내레이션 시작까지
const VO_TAIL = 0.7; // 내레이션 끝난 뒤 다음 장면까지
const GRAPHIC_MIN = 5;
const OUTRO_HOLD = 2.5;

const { scenes } = JSON.parse(readFileSync(join(root, 'src', 'narration.json'), 'utf8'));
const clipsMeta = JSON.parse(readFileSync(join(root, 'public', 'clips', 'clips.json'), 'utf8'));
const clipSec = Object.fromEntries(clipsMeta.clips.map((c) => [c.id, c.seconds]));
const cli = join(root, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');

function audioSeconds(rel) {
  const file = join(root, 'public', rel);
  if (!existsSync(file)) return null;
  const out = execFileSync(
    process.execPath,
    [cli, 'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { cwd: root, encoding: 'utf8' },
  );
  return +(+out.trim()).toFixed(3);
}

let from = 0;
const out = scenes.map((s, i) => {
  const vo = { ko: audioSeconds(`vo/ko/${s.id}.mp3`), en: audioSeconds(`vo/en/${s.id}.wav`) };
  const voMax = Math.max(vo.ko ?? 0, vo.en ?? 0);
  const clip = s.clip ? clipSec[s.clip] : null;
  if (s.clip && clip == null) throw new Error(`clip missing: ${s.clip}`);
  let sec = Math.max(clip ?? GRAPHIC_MIN, voMax ? VO_LEAD + voMax + VO_TAIL : 0);
  if (i === scenes.length - 1) sec += OUTRO_HOLD;
  const durationInFrames = Math.ceil(sec * FPS);
  const row = {
    id: s.id,
    clip: s.clip,
    from,
    durationInFrames,
    clipFrames: clip ? Math.round(clip * FPS) : null,
    voDelayFrames: Math.round(VO_LEAD * FPS),
    vo: {
      ko: vo.ko == null ? null : { file: `vo/ko/${s.id}.mp3`, frames: Math.ceil(vo.ko * FPS) },
      en: vo.en == null ? null : { file: `vo/en/${s.id}.wav`, frames: Math.ceil(vo.en * FPS) },
    },
  };
  from += durationInFrames;
  return row;
});

const timeline = {
  fps: FPS,
  durationInFrames: from,
  seconds: +(from / FPS).toFixed(2),
  recordedCommit: clipsMeta.commit,
  hasVo: { ko: out.every((r) => r.vo.ko), en: out.every((r) => r.vo.en) },
  scenes: out,
};
writeFileSync(join(root, 'src', 'timeline.json'), JSON.stringify(timeline, null, 2) + '\n');
console.log(`total ${timeline.seconds}s (${from} frames), vo ko=${timeline.hasVo.ko} en=${timeline.hasVo.en}`);
for (const r of out) console.log(`${r.id.padEnd(16)} ${(r.durationInFrames / FPS).toFixed(2)}s`);
