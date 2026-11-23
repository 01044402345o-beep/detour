// T3.1 [배포 전] 완료 조건 검증: vite preview(base /detour/) + Edge(playwright-core)
// 사용: node reviews/T3.1_verify.mjs <appDir> <outDir>
// 종료 코드: 결과가 PASS가 아니면(복구 빌드 실패 포함) 1 (R1 L-01).
// T31_READY_TIMEOUT_MS: '오프라인 준비 완료' 대기 시간(기본 30000). 실패 경로 확인용으로 아주 짧게 줄 수 있음.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [appDir, outDir] = process.argv.slice(2);
const { chromium } = await import(
  pathToFileURL(path.join(appDir, 'node_modules/playwright-core/index.mjs')).href
);
const PORT = 4180;
const READY_TIMEOUT = Number(process.env.T31_READY_TIMEOUT_MS ?? 30000);
const BASE = `http://localhost:${PORT}/detour/`;
const log = [];
const say = (s) => {
  console.log(s);
  log.push(s);
};

function startPreview() {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: appDir,
    shell: true,
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('preview timeout')), 30000);
    p.stdout.on('data', (d) => {
      if (String(d).includes(`${PORT}`)) {
        clearTimeout(t);
        resolve(p);
      }
    });
    p.stderr.on('data', (d) => process.stderr.write(d));
  });
}
function stopPreview(p) {
  try {
    execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* already gone */
  }
}
const distHrefs = () => {
  const html = fs.readFileSync(path.join(appDir, 'dist/index.html'), 'utf8');
  return {
    js: html.match(/assets\/index-[\w-]+\.js/)[0],
    css: html.match(/assets\/index-[\w-]+\.css/)[0],
  };
};

const cssPath = path.join(appDir, 'src/sw/updateToast.css');
const cssOrig = fs.readFileSync(cssPath, 'utf8');

const browser = await chromium.launch({ channel: 'msedge' });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'en-US',
});
const { installSpeechMock } = await import(
  pathToFileURL(path.join(appDir, 'e2e/speechMock.ts')).href
);
const page = await context.newPage();
await installSpeechMock(page, { stt: 'success', transcript: '튀김소보로 한 개 주세요.' });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
let preview;
let result = 'FAIL';
try {
  // ── 빌드 A ──
  execSync('npm run build', { cwd: appDir, stdio: 'ignore' });
  const hrefA = distHrefs();
  say(`빌드 A: ${hrefA.js} / ${hrefA.css}`);
  preview = await startPreview();

  // ① 온라인 첫 접속: 언어 선택 → 홈 → 설정(오프라인 준비 완료 대기). 방문 화면은 lang·home·settings 뿐
  await page.goto(BASE);
  await page.getByTestId('screen-lang').waitFor();
  await page.getByTestId('lang-en').click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByTestId('screen-home').waitFor();
  await page.goto(`${BASE}#/settings`);
  const t0 = Date.now();
  await page.getByTestId('offline-ready').waitFor({ timeout: READY_TIMEOUT });
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const status = await new Promise((res) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => res(e.data);
      reg.active.postMessage({ type: 'DETOUR_PRECACHE_STATUS' }, [ch.port2]);
    });
    return { scope: reg.scope, script: reg.active.scriptURL, controlled: !!navigator.serviceWorker.controller, status };
  });
  say(`오프라인 준비 완료 표시: ${Date.now() - t0}ms 안에 보임 — "${await page.getByTestId('offline-ready').innerText()}"`);
  say(`SW scope=${sw.scope} script=${sw.script} controlled=${sw.controlled} precache=${JSON.stringify(sw.status)}`);
  const manifestLink = await page.locator('link[rel=manifest]').getAttribute('href');
  const mf = await (await page.request.get(new URL(manifestLink, BASE).href)).json();
  say(`manifest ${manifestLink}: start_url=${mf.start_url} scope=${mf.scope} icons=${mf.icons.length}`);
  await page.screenshot({ path: path.join(outDir, 'T3.1_settings_ready.png') });

  // ② 네트워크 차단 → 새로고침 → 전 화면(미방문 포함)을 각각 새로고침으로 열기
  // ②-0 첫 방문 그대로(새로고침 없이) 네트워크 차단 → 미방문 화면으로 앱 안 이동
  await context.setOffline(true);
  for (const [r, key] of [
    ['/phrases', 'phrases'],
    ['/place/mus', 'place'],
    ['/report', 'report'],
  ]) {
    await page.evaluate((h) => (location.hash = h), r);
    const ok = await page
      .getByTestId(`screen-${key}`)
      .waitFor({ timeout: 8000 })
      .then(() => true, () => false);
    say(`첫 방문·새로고침 없이 오프라인 → #${r}: ${ok ? '열림' : '실패'}`);
    if (!ok) throw new Error(`offline in-app nav failed: ${r}`);
  }
  await page.reload();
  await page.getByTestId('screen-report').waitFor();
  say('오프라인 새로고침: 운영자 리포트 화면 열림');
  const routes = [
    ['/', 'home'],
    ['/course', 'course'],
    ['/place/ssd', 'place'],
    ['/place/eun', 'place'],
    ['/place/mus', 'place'],
    ['/place/gwc', 'place'],
    ['/phrases', 'phrases'],
    ['/saved', 'saved'],
    ['/settings', 'settings'],
    ['/report', 'report'],
    ['/lang', 'lang'],
  ];
  const rows = [];
  for (const [r, key] of routes) {
    await page.goto(`${BASE}#${r}`);
    await page.reload();
    const ok = await page
      .getByTestId(`screen-${key}`)
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    rows.push(`| \`#${r}\` | screen-${key} | ${ok ? '열림' : '**실패**'} |`);
    if (!ok) throw new Error(`offline route failed: ${r}`);
  }
  // 코스: 오프라인이면 SVG 약도
  await page.goto(`${BASE}#/course`);
  await page.reload();
  const sketch = await page.getByTestId('map-sketch').waitFor({ timeout: 8000 }).then(() => true, () => false);
  const tiles = await page.getByTestId('map-tiles').count();
  say(`코스 지도 오프라인: map-sketch 보임=${sketch}, map-tiles 개수=${tiles}`);
  if (!sketch) throw new Error('sketch map not shown offline');
  await page.screenshot({ path: path.join(outDir, 'T3.1_offline_course.png') });

  // 오프라인 주문 흐름: 홈 → 원도심 → 성심당(미방문) → 담기 → 내 주문 → 직원 화면·연습 화면
  await page.goto(`${BASE}#/`);
  await page.reload();
  await page.getByTestId('hub-downtown').click();
  await page.getByTestId('screen-course').waitFor();
  await page.getByTestId('stop-ssd').click();
  await page.getByTestId('screen-place').waitFor();
  const inc = page.getByTestId('menu-tw').getByRole('button', { name: 'Add one' });
  if ((await inc.count()) === 0) {
    await page.getByTestId('menu-tw').getByRole('button').last().click();
  } else await inc.click();
  await page.getByTestId('orderbar').click();
  await page.getByTestId('screen-order').waitFor();
  const ko = await page.getByTestId('order-ko').innerText();
  say(`오프라인 주문 흐름: 내 주문 문장 "${ko}"`);
  await page.screenshot({ path: path.join(outDir, 'T3.1_offline_order.png') });
  // 담은 뒤 UI 흐름: 내 주문 → 연습(STT 목) → 결과 → 직원 화면 → 응답 (모두 오프라인·미방문)
  const step = async (label, key) => {
    const ok = await page
      .getByTestId(`screen-${key}`)
      .waitFor({ timeout: 8000 })
      .then(() => true, () => false);
    rows.push(`| ${label} | screen-${key} | ${ok ? '열림' : '**실패**'} |`);
    if (!ok) throw new Error(`offline flow failed: ${key}`);
  };
  rows.push('| 성심당 담기 → 내 주문 (UI) | screen-order | 열림 |');
  await page.getByRole('button', { name: 'Practice saying it' }).click();
  await step('내 주문 → 연습 (UI)', 'practice');
  await page.getByRole('button', { name: 'Start recording' }).click();
  await step('연습 → 결과 (UI, STT 목)', 'result');
  const score = await page.getByTestId('result-score').innerText();
  await page.getByRole('button', { name: 'Show this to staff instead' }).click();
  await step('결과 → 직원 화면 (UI)', 'staff');
  await page.locator('[data-reply="sold"]').click();
  await step('직원 화면 → 응답 (UI)', 'reply');
  say(`오프라인 연습 결과 점수: ${score}`);
  for (const [r, key] of [
    ['/order', 'order'],
    ['/staff', 'staff'],
  ]) {
    await page.goto(`${BASE}#${r}`);
    await page.reload();
    await step(`\`#${r}\` 새로고침`, key);
  }
  say('\n| 경로 | 보인 화면 | 결과 |\n|---|---|---|\n' + rows.join('\n'));

  // ③ 업데이트: 온라인 복귀 → 빌드 B(임시로 CSS 값 1개 추가)로 다시 build·preview → 새로고침 → 토스트
  await context.setOffline(false);
  await page.goto(`${BASE}#/`);
  await page.reload();
  await page.getByTestId('screen-home').waitFor();
  stopPreview(preview);
  fs.writeFileSync(cssPath, cssOrig + '\n.ui-toast--update {\n  --detour-build: b;\n}\n');
  try {
    execSync('npm run build', { cwd: appDir, stdio: 'ignore' });
  } finally {
    fs.writeFileSync(cssPath, cssOrig);
  }
  const hrefB = distHrefs();
  say(`빌드 B: ${hrefB.js} / ${hrefB.css} (A와 CSS 다름=${hrefA.css !== hrefB.css})`);
  preview = await startPreview();
  await page.reload();
  await page.getByTestId('update-toast').waitFor({ timeout: 30000 });
  say(`새로고침 후 업데이트 토스트: "${(await page.getByTestId('update-toast').innerText()).replace(/\s+/g, ' ')}"`);
  const before = await page.evaluate(() => document.querySelector('link[rel=stylesheet][href*="assets/index-"]').getAttribute('href'));
  say(`토스트 시점 화면의 CSS: ${before} (아직 A)`);
  await page.screenshot({ path: path.join(outDir, 'T3.1_update_toast.png') });

  // 업데이트 토스트 + 일반 토스트 동시 표시: 겹치지 않고, 탭바와도 안 겹치고, 업데이트 버튼을 누를 수 있어야 함 (R1 M-02)
  await page.evaluate(() => (location.hash = '/phrases'));
  await page.getByTestId('screen-phrases').waitFor();
  for (const [w, h] of [
    [390, 844],
    [360, 780],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.locator('.phr-bm').first().click();
    const plain = page.locator('[data-testid="toast-region"] .ui-toast:not(.ui-toast--update)');
    await plain.waitFor();
    await page.waitForTimeout(400); // 등장 애니메이션(0~10%) 끝난 뒤 측정
    const m = await page.evaluate(() => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      const up = document.querySelector('[data-testid="update-toast"]');
      const pl = document.querySelector('[data-testid="toast-region"] .ui-toast:not(.ui-toast--update)');
      const tab = document.querySelector('.ui-tabbar');
      const btn = document.querySelector('[data-testid="update-apply"]');
      const b = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return {
        up: box(up),
        plain: box(pl),
        plainText: pl.textContent,
        tab: tab ? box(tab) : null,
        applyHit: btn === hit || btn.contains(hit),
        applySize: [Math.round(b.width), Math.round(b.height)],
      };
    });
    const gap = Math.round(m.plain.top - m.up.bottom);
    const aboveTab = m.tab ? m.plain.bottom <= m.tab.top && m.up.bottom <= m.tab.top : true;
    say(
      `${w}px 토스트 2개: 업데이트 토스트 하단~일반 토스트("${m.plainText}") 상단 간격 ${gap}px, ` +
        `탭바 위=${aboveTab}, 업데이트 버튼 클릭 가능=${m.applyHit} (${m.applySize.join('×')})`,
    );
    await page.screenshot({ path: path.join(outDir, `T3.1_toast_stack_${w}.png`) });
    if (gap < 0 || !aboveTab || !m.applyHit) throw new Error(`toast overlap at ${w}px`);
    await plain.waitFor({ state: 'detached', timeout: 5000 });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => (location.hash = '/'));
  await page.getByTestId('screen-home').waitFor();
  await Promise.all([page.waitForEvent('load', { timeout: 30000 }), page.getByTestId('update-apply').click()]);
  await page.getByTestId('screen-home').waitFor();
  const after = await page.evaluate(() => document.querySelector('link[rel=stylesheet][href*="assets/index-"]').getAttribute('href'));
  const toastGone = (await page.getByTestId('update-toast').count()) === 0;
  say(`'Update' 클릭 → 새로고침 → CSS: ${after} (B 적용=${after.endsWith(hrefB.css)}), 토스트 사라짐=${toastGone}`);
  if (!after.endsWith(hrefB.css) || !toastGone) throw new Error('update not applied');
  await page.goto(`${BASE}#/settings`);
  await page.getByTestId('offline-ready').waitFor({ timeout: 30000 });
  say('새 버전에서도 오프라인 준비 완료 표시');
  say(`잡히지 않은 페이지 오류: ${pageErrors.length}건 ${pageErrors.join(' / ')}`);
  if (pageErrors.length) throw new Error('page errors');
  result = 'PASS';
} catch (e) {
  say(`오류: ${e.message}`);
} finally {
  if (preview) stopPreview(preview);
  await browser.close();
  // dist를 원래 소스 빌드로 되돌림
  // 복구 빌드가 실패하면 결과를 FAIL로 (예외를 삼키지 않고 종료 코드로 알림)
  fs.writeFileSync(cssPath, cssOrig);
  try {
    execSync('npm run build', { cwd: appDir, stdio: 'ignore' });
  } catch (e) {
    say(`복구 빌드 실패: ${e.message}`);
    result = 'FAIL';
  }
  say(`결과: ${result}`);
  fs.writeFileSync(path.join(outDir, 'T3.1_verify.log'), log.join('\n'));
  if (result !== 'PASS') process.exitCode = 1;
}
