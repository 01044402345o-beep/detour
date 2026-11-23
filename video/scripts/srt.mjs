#!/usr/bin/env node
/** src/narration.json + src/timeline.json → captions/detour-demo.{ko,en}.srt (영상에 넣은 자막과 같은 문장·시각) */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { scenes: text } = JSON.parse(readFileSync(join(root, 'src', 'narration.json'), 'utf8'));
const tl = JSON.parse(readFileSync(join(root, 'src', 'timeline.json'), 'utf8'));
const byId = new Map(text.map((s) => [s.id, s]));
const ts = (f) => {
  const ms = Math.round((f / tl.fps) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
mkdirSync(join(root, 'captions'), { recursive: true });
for (const lang of ['ko', 'en']) {
  const body = tl.scenes
    .map((s, i) => {
      const start = s.from + s.voDelayFrames;
      const end = s.from + s.durationInFrames - 1;
      return `${i + 1}\n${ts(start)} --> ${ts(end)}\n${byId.get(s.id)[lang]}\n`;
    })
    .join('\n');
  writeFileSync(join(root, 'captions', `detour-demo.${lang}.srt`), body);
}
console.log('captions/detour-demo.ko.srt, captions/detour-demo.en.srt');
