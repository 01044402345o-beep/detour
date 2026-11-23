#!/usr/bin/env node
/**
 * 녹화 프레임(public/clips/raw/frames/*.jpg, 화면이 바뀔 때만 들어옴)과 marks.json의 장면 시각으로
 * 장면별 30fps H.264 mp4(public/clips/<장면>.mp4)와 public/clips/clips.json을 만듭니다.
 * ffmpeg는 Remotion 내장본(`remotion ffmpeg`)을 씁니다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'clips');
const RAW = join(OUT, 'raw');
const meta = JSON.parse(readFileSync(join(RAW, 'marks.json'), 'utf8'));
const cli = join(root, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const FPS = 30;
const frames = meta.frames;

/** 시각 t에 화면에 보이던 프레임(마지막으로 받은 프레임) */
function frameAt(t) {
  let lo = 0;
  for (let i = 0; i < frames.length && frames[i].t <= t; i++) lo = i;
  return frames[lo];
}

const clips = meta.marks.map((m) => {
  const file = `${m.id}.mp4`;
  const n = Math.round((m.end - m.start) * FPS);
  // 일정 30fps로 프레임을 골라 concat 목록 작성 (같은 프레임이 이어지면 duration을 합침)
  const lines = ['ffconcat version 1.0'];
  let prev = null;
  let run = 0;
  const flush = () => {
    if (!prev) return;
    lines.push(`file '${join(RAW, 'frames', prev.file).replace(/\\/g, '/')}'`, `duration ${(run / FPS).toFixed(4)}`);
  };
  for (let i = 0; i < n; i++) {
    const f = frameAt(m.start + i / FPS);
    if (f === prev) run++;
    else {
      flush();
      prev = f;
      run = 1;
    }
  }
  flush();
  lines.push(`file '${join(RAW, 'frames', prev.file).replace(/\\/g, '/')}'`); // concat 마지막 duration 반영용
  const list = join(RAW, `${m.id}.ffconcat`);
  writeFileSync(list, lines.join('\n'));
  execFileSync(
    process.execPath,
    [cli, 'ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'scale=780:1688', '-r', String(FPS), '-fps_mode', 'cfr',
      '-frames:v', String(n), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', join(OUT, file)],
    { cwd: root, stdio: 'inherit' },
  );
  const seconds = +(n / FPS).toFixed(2);
  console.log(`${file}  ${m.start}s +${seconds}s  ${m.label}`);
  return { id: m.id, label: m.label, file: `clips/${file}`, sourceStart: m.start, seconds };
});
const { marks: _m, frames: _f, ...rest } = meta;
writeFileSync(join(OUT, 'clips.json'), JSON.stringify({ ...rest, frameCount: frames.length, fps: FPS, clips }, null, 2));
