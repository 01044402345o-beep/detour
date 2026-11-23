#!/usr/bin/env node
/**
 * T2.7 앱 화면 자동 녹화 (사용자 결정 U-1).
 *
 * - 대상: 녹화 커밋(기본 cfc8097, Phase 2 배포 커밋)의 앱을 `git archive`로 따로 꺼내
 *   `npm run build`(base /detour/) 후 `vite preview`로 띄운 주소. 작업 중인 app/ 폴더는 건드리지 않습니다.
 * - 브라우저: 설치된 Microsoft Edge(channel msedge), 390×844 · DPR 2, 영어 UI.
 * - 음성: Web Speech API 목(scripts/speechMock.mjs) — 인식 장면은 '재현 장면'으로 영상에 표시합니다.
 * - 결과: 한 번 이어서 녹화한 프레임(CDP 스크린캐스트 JPEG)·프레임 시각·장면 표시 시각(public/clips/raw/, git 제외).
 *   장면별 mp4 자르기는 scripts/cut.mjs.
 *
 * 사용: node scripts/record.mjs --url http://localhost:4174/detour/ --commit cfc8097
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { installSpeechMock, installTapIndicator } from './speechMock.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const BASE = args.url ?? 'http://localhost:4174/detour/';
const COMMIT = args.commit ?? 'cfc8097';
const OUT = join(root, 'public', 'clips');
const RAW = join(OUT, 'raw');
const VIEW = { width: 390, height: 844 };
const DPR = 2;

/** 영어 사전 값(녹화 커밋 기준)은 화면 문구로 버튼을 찾을 때만 씁니다. */
const EN = {
  start: 'Get started',
  increase: 'Add one',
  listen: 'Listen',
  practice: 'Practice saying it',
  micStart: 'Start recording',
  instead: 'Show this to staff instead',
  switchConfirm: 'Clear and continue',
  me: 'Me',
};
const SSD_ORDER_KO = '튀김소보로 두 개, 판타롱부추빵 한 개 주세요.';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

// headless 스크린캐스트는 --force-device-scale-factor가 있어야 기기 픽셀(780×1688)로 나옵니다.
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: [`--force-device-scale-factor=${DPR}`],
});
const context = await browser.newContext({
  viewport: VIEW,
  deviceScaleFactor: DPR,
  isMobile: true,
  hasTouch: true,
  locale: 'en-US',
  timezoneId: 'Asia/Seoul',
  serviceWorkers: 'block',
});
await installSpeechMock(context, { transcript: SSD_ORDER_KO, listenMs: 2600, speakMs: 2400 });
await installTapIndicator(context);

const page = await context.newPage();

// Playwright recordVideo는 DPR을 반영하지 않아(390×844로 찍힘) CDP 스크린캐스트로 기기 픽셀(780×1688) 프레임을 받습니다.
// 화면이 바뀔 때만 프레임이 오므로 프레임마다 받은 시각을 같이 저장하고, cut.mjs가 일정 30fps로 다시 짭니다.
const FRAMES = join(RAW, 'frames');
mkdirSync(FRAMES, { recursive: true });
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
  const file = `${String(frames.length).padStart(5, '0')}.jpg`;
  writeFileSync(join(FRAMES, file), Buffer.from(data, 'base64'));
  frames.push({ file, t: +((Date.now() - t0) / 1000).toFixed(3) });
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
const t0 = Date.now();
await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 92,
  maxWidth: VIEW.width * DPR,
  maxHeight: VIEW.height * DPR,
  everyNthFrame: 1,
});
const marks = [];
const now = () => (Date.now() - t0) / 1000;
const pause = (s) => page.waitForTimeout(s * 1000);
let current = null;
function scene(id, label) {
  if (current) current.end = now();
  current = { id, label, start: now(), end: null };
  marks.push(current);
  console.log(`[${current.start.toFixed(2)}s] ${id} ${label}`);
}
async function tap(locator) {
  await locator.scrollIntoViewIfNeeded();
  await pause(0.35);
  await locator.click();
}
async function smoothScroll(dy, steps = 12) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await pause(0.06);
  }
}
const byText = (name) => page.getByRole('button', { name }).first();

// ---- 준비: 빈 페이지가 잠깐 보이는 앞부분은 장면 밖으로 둡니다
await page.goto(BASE);
await page.getByTestId('screen-lang').waitFor();
await pause(0.5);

// S02 언어 선택
scene('s02_lang', 'Language select');
await pause(1.4);
await tap(page.getByTestId('lang-en'));
await pause(1.0);
await tap(byText(EN.start));
await page.getByTestId('screen-home').waitFor();
await pause(2.2);

// S03 원도심 코스
scene('s03_course', 'Old Downtown course');
await tap(page.getByTestId('hub-downtown'));
await page.getByTestId('screen-course').waitFor();
await page.waitForLoadState('networkidle').catch(() => {});
await pause(2.6);
await smoothScroll(420);
await pause(2.0);

// S04 성심당 메뉴 담기 (비제휴 안내 노출 포함)
scene('s04_ssd_menu', 'Sungsimdang menu');
await tap(page.getByTestId('stop-ssd'));
await page.getByTestId('screen-place').waitFor();
await pause(1.6);
const disclaimer = page.getByText('Independent guide — not affiliated', { exact: false }).first();
if (await disclaimer.count()) {
  await disclaimer.scrollIntoViewIfNeeded();
  await pause(2.2);
}
const tw = page.getByTestId('menu-tw');
await tw.scrollIntoViewIfNeeded();
await pause(0.8);
await tap(tw.getByRole('button', { name: EN.increase }));
await pause(0.6);
await tap(tw.getByRole('button', { name: EN.increase }));
await pause(0.8);
await tap(page.getByTestId('menu-bu').getByRole('button', { name: EN.increase }));
await pause(1.6);

// S05 한국어 주문 카드
scene('s05_order_card', 'Korean order card');
await tap(page.getByTestId('orderbar'));
await page.getByTestId('screen-order').waitFor();
await pause(2.0);
const listen = page.getByRole('button', { name: EN.listen, exact: true }).first();
if (await listen.count()) {
  await tap(listen);
  await pause(2.8);
} else {
  await pause(2.0);
}

// S06 듣고 따라 말하기 · 인식 일치도 (음성 인식은 목 = 재현 장면)
scene('s06_practice', 'Practice & recognition match (reenactment)');
await tap(byText(EN.practice));
await page.getByTestId('screen-practice').waitFor();
await pause(2.0);
await tap(page.getByRole('button', { name: EN.micStart }));
await page.getByTestId('screen-result').waitFor({ timeout: 15_000 });
await pause(3.6);

// S07 직원에게 보여주기 · 직원 응답
scene('s07_staff', 'Show to staff & staff reply');
await tap(byText(EN.instead));
await page.getByTestId('screen-staff').waitFor();
await pause(3.0);
await tap(page.locator('[data-reply="yes"]'));
await page.getByTestId('screen-reply').waitFor();
await pause(2.8);

// S08 광천식당 (매장 식사 전용)
scene('s08_gwc', 'Gwangcheon Sikdang (dine-in)');
await page.goto(`${BASE}#/course`);
await page.getByTestId('screen-course').waitFor();
await pause(1.0);
await tap(page.getByTestId('stop-gwc'));
await page.getByTestId('screen-place').waitFor();
await pause(1.6);
const dt = page.getByTestId('menu-dt');
await dt.scrollIntoViewIfNeeded();
await pause(0.6);
await tap(dt.getByRole('button', { name: EN.increase }));
const sheet = page.getByRole('dialog');
await sheet.waitFor();
await pause(1.6);
await tap(sheet.getByRole('button', { name: EN.switchConfirm }));
await pause(1.0);
await tap(page.getByTestId('orderbar'));
await page.getByTestId('screen-order').waitFor();
await pause(3.2);

// S09 운영자 리포트 (설정 → 운영자 리포트, 예시 데이터)
scene('s09_report', 'Operator report (sample data)');
await page.goto(`${BASE}#/settings`);
await page.getByTestId('screen-settings').waitFor();
await pause(1.2);
await tap(page.getByTestId('open-report'));
await page.getByTestId('screen-report').waitFor();
await pause(2.4);
await smoothScroll(520, 16);
await pause(2.0);
await smoothScroll(520, 16);
await pause(2.4);
current.end = now();

await pause(0.3);
await cdp.send('Page.stopScreencast');
await context.close();
await browser.close();

writeFileSync(
  join(RAW, 'marks.json'),
  JSON.stringify(
    {
      commit: COMMIT,
      url: BASE,
      viewport: VIEW,
      deviceScaleFactor: DPR,
      browser: 'msedge',
      lang: 'en',
      recordedAt: new Date().toISOString(),
      end: +now().toFixed(3),
      frames,
      marks: marks.map((m) => ({ ...m, start: +m.start.toFixed(2), end: +m.end.toFixed(2) })),
    },
    null,
    2,
  ),
);
console.log('recorded → public/clips/raw/frames/ (+ marks.json). Next: node scripts/cut.mjs');
