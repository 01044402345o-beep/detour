// T3.2 성능·접근성 측정 — 3회차 (reviews/T3.2_r1_verdict.md 반영)
// 사용: node reviews/T3.2_measure.mjs <toolsDir> <srcAppDir> <outDir> [commit]
//   toolsDir : playwright-core·@axe-core/playwright·axe-core·lighthouse·puppeteer-core 를 설치한 app 밖 폴더
//   srcAppDir: `git archive <commit> app` 을 푼 측정 전용 폴더(작업 트리와 분리). npm ci 가 끝나 있어야 함
//   outDir   : reviews (결과 T3.2_results.json · T3.2_dist_manifest.json · T3.2_lh/*.json · 실패 캡처)
// 단계: 빌드 1회 → dist SHA-256 manifest → (1) 첫 로드 JS → (2) Fast 4G LCP → (4)(5) 상태 목록 × 3개 언어
//       axe·대비 판정·44px → (3) Lighthouse 13개 라우트 → 끝에 manifest 재확인(다르면 실패)
// 앱 소스는 읽기만 합니다. SKIP_BUILD=1 이면 기존 dist 사용.
import { execSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [toolsDir, appDir, outDir] = process.argv.slice(2, 5).map((p) => path.resolve(p));
const COMMIT = process.argv[5] ?? null;
const req = createRequire(path.join(toolsDir, 'package.json'));
const imp = (m) => import(pathToFileURL(req.resolve(m)).href);
const pkgVer = (m) => JSON.parse(fs.readFileSync(path.join(toolsDir, 'node_modules', m, 'package.json'), 'utf8')).version;
const pw = await imp('playwright-core');
const chromium = pw.chromium ?? pw.default.chromium;
const { default: AxeBuilder } = await imp('@axe-core/playwright');
const lhMod = await imp('lighthouse');
const lighthouse = lhMod.default;
const lhSnapshot = lhMod.snapshot;
const desktopConfig = (
  await import(
    pathToFileURL(path.join(path.dirname(req.resolve('lighthouse/package.json')), 'core/config/desktop-config.js')).href
  )
).default;
const puppeteer = (await imp('puppeteer-core')).default;
const { installSpeechMock } = await import(pathToFileURL(path.join(appDir, 'e2e/speechMock.ts')).href);

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 4182; // vite preview
const PROXY_PORT = 4184; // 업데이트 토스트용 (sw.js 바이트만 바꿔 전달)
const BASE = `http://localhost:${PORT}/detour/`;
const PBASE = `http://localhost:${PROXY_PORT}/detour/`;
const FAST4G = {
  offline: false,
  latency: 60 * 2.75,
  downloadThroughput: ((9 * 1000 * 1000) / 8) * 0.9,
  uploadThroughput: ((1.5 * 1000 * 1000) / 8) * 0.9,
  connectionType: 'cellular4g',
};
const LCP_OBSERVE_AFTER_LOAD_MS = 3000;
const NEED = 4.5; // PRD 7장: 모든 글자 4.5:1 (큰 글자 3:1 완화 없음)
const VIEWPORT = { width: 390, height: 844 };
const LANGS = ['en', 'ja', 'zh'];
const dicts = Object.fromEntries(
  LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(appDir, `src/i18n/${l}.json`), 'utf8'))]),
);
const tr = (l, k) => k.split('.').reduce((o, x) => o?.[x], dicts[l]);
const SSD_KO = '튀김소보로 두 개, 판타롱부추빵 한 개 주세요.';

const out = { meta: {}, startedAt: new Date().toISOString() };
const say = (...a) => console.log(...a);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const gz = (f) => zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── dist manifest ──
function distManifest() {
  const root = path.join(appDir, 'dist');
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const buf = fs.readFileSync(p);
        files.push({
          path: path.relative(root, p).split(path.sep).join('/'),
          bytes: buf.length,
          sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        });
      }
    }
  };
  walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  const digest = crypto
    .createHash('sha256')
    .update(files.map((f) => `${f.path}:${f.sha256}`).join('\n'))
    .digest('hex');
  return { digest, count: files.length, files };
}

function startPreview() {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: appDir, shell: true });
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
const kill = (p) => {
  try {
    execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* gone */
  }
};

// 업데이트 토스트용 프록시: swBump=true 이면 /detour/sw.js 끝에 주석 1줄을 붙여 "새 워커"로 보이게 함
let swBump = false;
function startProxy() {
  const srv = http.createServer((creq, cres) => {
    const preq = http.request(
      { host: 'localhost', port: PORT, path: creq.url, method: creq.method, headers: { ...creq.headers, host: `localhost:${PORT}`, 'accept-encoding': 'identity' } },
      (pres) => {
        if (creq.url.split('?')[0] === '/detour/sw.js') {
          const chunks = [];
          pres.on('data', (c) => chunks.push(c));
          pres.on('end', () => {
            let body = Buffer.concat(chunks);
            if (swBump) body = Buffer.concat([body, Buffer.from('\n// t32-update-bump\n')]);
            const h = { ...pres.headers, 'content-length': body.length, 'cache-control': 'no-cache' };
            delete h['transfer-encoding'];
            delete h.etag;
            delete h['last-modified'];
            cres.writeHead(pres.statusCode, h);
            cres.end(body);
          });
        } else {
          cres.writeHead(pres.statusCode, pres.headers);
          pres.pipe(cres);
        }
      },
    );
    preq.on('error', () => cres.destroy());
    creq.pipe(preq);
  });
  return new Promise((r) => srv.listen(PROXY_PORT, () => r(srv)));
}

const MARK_SCRIPT = () => {
  window.__t32 = { dom: {}, lcp: 0, lcpCount: 0 };
  const check = () => {
    for (const id of ['screen-lang', 'screen-home']) {
      if (window.__t32.dom[id]) continue;
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el && el.getBoundingClientRect().height > 0) window.__t32.dom[id] = performance.now();
    }
  };
  new MutationObserver(check).observe(document, { childList: true, subtree: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__t32.lcp = e.startTime;
      window.__t32.lcpCount++;
      window.__t32.lcpEl = e.element ? e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : '') : e.url;
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
};

async function chooseLang(page, lang, base = BASE) {
  await page.goto(base);
  await page.getByTestId('screen-lang').waitFor();
  await page.getByTestId(`lang-${lang}`).click();
  await page.locator('.lang-start').click();
  await page.getByTestId('screen-home').waitFor();
}
async function addMenu(page, lang, menu, n) {
  for (let i = 0; i < n; i++)
    await page.getByTestId(`menu-${menu}`).getByRole('button', { name: tr(lang, 'menu.increase') }).click();
}

// ── 44px 검사 (L-01 규칙) ──
// 대상: 버튼·링크와 같은 역할 요소 + 네이티브 radio/checkbox.
// 대신 재기: 시각적으로 숨긴 네이티브 input[type=radio|checkbox] → 감싼 label 상자로 판정(그 밖의 요소는 자기 상자).
// 제외: display:none · visibility:hidden · inert 조상 · 너비나 높이 0 (aria-hidden 은 제외 사유가 아님). 제외 목록은 touchExcluded.
const TOUCH_SEL =
  'button, a[href], [role="button"], [role="link"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], summary, input[type="button"], input[type="submit"], input[type="radio"], input[type="checkbox"]';
async function touchCheck(page) {
  return page.evaluate((sel) => {
    const path = (el) => {
      const parts = [];
      for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
        let s = e.tagName.toLowerCase();
        if (e.dataset?.testid) s += `[data-testid="${e.dataset.testid}"]`;
        else if (typeof e.className === 'string' && e.className.trim()) s += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.');
        parts.unshift(s);
        if (e.dataset?.testid) break;
      }
      return parts.join(' > ');
    };
    const hiddenBy = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none') return 'display:none';
        if (e.hasAttribute('inert')) return 'inert';
      }
      if (getComputedStyle(el).visibility === 'hidden') return 'visibility:hidden';
      return null;
    };
    const visuallyHidden = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (r.width <= 1 && r.height <= 1) || cs.clipPath.includes('inset(50%') || cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.opacity === '0';
    };
    const checked = [];
    const excluded = [];
    for (const el of document.querySelectorAll(sel)) {
      const h = hiddenBy(el);
      if (h) {
        excluded.push({ sel: path(el), reason: h });
        continue;
      }
      let box = el;
      let via = null;
      if (el.matches('input[type="radio"], input[type="checkbox"]') && visuallyHidden(el)) {
        const label = el.closest('label') ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
        if (label) {
          box = label;
          via = 'label';
        }
      }
      const r = box.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        excluded.push({ sel: path(el), reason: 'zero-size' });
        continue;
      }
      checked.push({
        sel: path(el),
        label: (el.getAttribute('aria-label') || box.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        ariaHidden: !!el.closest('[aria-hidden="true"]'),
        via,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        ok: r.width >= 44 && r.height >= 44,
      });
    }
    return { checked, excluded };
  }, TOUCH_SEL);
}

// ── 대비: axe incomplete(color-contrast) 노드 + axe pass 중 4.5 미만 노드를 노드별로 판정 (M-02) ──
async function contrastVerdicts(page, axe, ctxInfo) {
  const targets = [];
  for (const v of axe.incomplete.filter((x) => x.id === 'color-contrast'))
    for (const n of v.nodes) targets.push({ target: n.target.join(' '), source: 'incomplete', reason: n.any.map((a) => a.data?.messageKey ?? '').join(',') });
  const lowPasses = [];
  for (const v of axe.passes.filter((x) => x.id === 'color-contrast'))
    for (const n of v.nodes) {
      const cr = n.any[0]?.data?.contrastRatio;
      if (cr && cr < NEED) lowPasses.push({ target: n.target.join(' '), ratio: cr });
    }
  // 0) 글자색은 글자를 투명하게 만들기 전에 읽어 둔다
  const pre = await page.evaluate(
    (sels) => sels.map((s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); return el instanceof SVGElement ? cs.fill : cs.color; }), // SVG 글자는 fill 로 그려짐
    targets.map((t) => t.target),
  );
  // 1) 글자를 투명하게 → 노드마다 (화면 안으로 옮김 → 글자 영역·배경 스택 계산 → 그 자리에서 캡처)
  //    가려지면 center → start → end 순서로 위치를 바꿔 다시 잼 (하단 바·토스트와의 겹침 회피)
  const style = await page.addStyleTag({
    content: '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;transition:none!important;animation:none!important}',
  });
  await page.waitForTimeout(100);
  const infos = [];
  for (let k = 0; k < targets.length; k++) {
    const t = targets[k];
    let info;
    for (const block of ['center', 'start', 'end']) {
    info = await page.evaluate(({ sel, block, fgColor }) => {
      const el = document.querySelector(sel);
      if (!el || !fgColor) return { missing: true };
      // Leaflet 지도 안 요소는 지도 상자를 옮김(지도 내부 스크롤은 Leaflet 이 되돌려 좌표가 어긋남)
      (el.closest('.leaflet-container') ?? el).scrollIntoView({ block, inline: 'nearest' });
      const parse = (c) => {
        const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
        return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 };
      };
      const cs = getComputedStyle(el);
      // 글자 영역: 직계·하위 텍스트 노드의 줄 상자
      const range = document.createRange();
      const rects = [];
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.textContent.trim()) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(r);
      }
      if (!rects.length) return { noText: true };
      const x0 = Math.min(...rects.map((r) => r.left));
      const y0 = Math.min(...rects.map((r) => r.top));
      const x1 = Math.max(...rects.map((r) => r.right));
      const y1 = Math.max(...rects.map((r) => r.bottom));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // 글자 중심 아래 쌓인 요소들(위→아래)에서 배경 합성
      const stack = document.elementsFromPoint(cx, cy);
      const topEl = stack[0];
      const overlapped = topEl && !(el === topEl || el.contains(topEl) || topEl.contains(el));
      let opacity = 1;
      for (let e = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
      const fg = parse(fgColor);
      const layers = [];
      let image = null;
      let reachedOpaque = false;
      const start = stack.indexOf(el) >= 0 ? stack.indexOf(el) : 0;
      // el 자신과 그 조상은 stack 에 포함됨. el 아래로 내려가며 배경을 모은다
      const under = [el, ...stack.slice(start + 1)];
      const seen = new Set();
      for (const e of under) {
        if (seen.has(e)) continue;
        seen.add(e);
        const s = getComputedStyle(e);
        if (s.backgroundImage && s.backgroundImage !== 'none') {
          image = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} background-image`;
          break;
        }
        if (['IMG', 'CANVAS', 'VIDEO'].includes(e.tagName) || (e instanceof SVGElement && e.tagName.toLowerCase() === 'svg')) {
          image = `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).split(' ')[0]}`;
          break;
        }
        const bg = parse(s.backgroundColor);
        if (bg.a > 0) {
          layers.push({ el: `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`, ...bg });
          if (bg.a >= 1) {
            reachedOpaque = true;
            break;
          }
        }
      }
      return {
        fg,
        opacity,
        fontSize: parseFloat(cs.fontSize),
        fontWeight: Number(cs.fontWeight),
        layers,
        image,
        reachedOpaque,
        overlapped: overlapped ? `${topEl.tagName.toLowerCase()}.${String(topEl.className).split(' ')[0]}` : null,
        textBox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
        ariaHidden: !!el.closest('[aria-hidden="true"]'),
      };
    }, { sel: t.target, block, fgColor: pre[k] });
      if (!info.overlapped || info.missing || info.noText) break;
    }
    if (!info.missing && !info.noText) {
      info.pix = null;
      const tb = info.textBox;
      const vp = page.viewportSize();
      if (tb.w >= 1 && tb.h >= 1 && tb.x >= 0 && tb.y >= 0 && tb.x + tb.w <= vp.width + 1 && tb.y + tb.h <= vp.height + 1) {
        const png = await page.screenshot({ clip: { x: tb.x, y: tb.y, width: tb.w, height: tb.h }, scale: 'css', animations: 'disabled' });
        info.pix = await decodeStats(png, info.fg, info.opacity);
      }
    }
    infos.push(info);
  }
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => {
    const x = L(a);
    const y = L(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const res = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const info = infos[i];
    if (info.missing || info.noText) {
      res.push({ ...t, ...ctxInfo, verdict: info.missing ? '미확인' : '제외', basis: info.missing ? '요소를 다시 찾지 못함' : '글자 없음(검사 대상 아님)' });
      continue;
    }
    const pix = info.pix;
    // CSS 스택 합성
    let cssBg = null;
    let cssRatio = null;
    if (!info.image && info.reachedOpaque) {
      let c = { r: 255, g: 255, b: 255, a: 1 };
      for (const l of [...info.layers].reverse()) c = over(l, c);
      cssBg = c;
      const fgEff = { ...info.fg, a: info.fg.a * info.opacity };
      cssRatio = ratio(over(fgEff, cssBg), cssBg);
    }
    // 반투명 막 위 이미지: 막 아래가 검정·흰색인 최악 합성
    let worstOverlay = null;
    if (info.image && info.layers.length) {
      const fgEff = { ...info.fg, a: info.fg.a * info.opacity };
      const vals = [{ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }].map((base) => {
        let c = base;
        for (const l of [...info.layers].reverse()) c = over(l, c);
        return ratio(over(fgEff, c), c);
      });
      worstOverlay = Math.min(...vals);
    }
    const sel = t.target;
    let verdict;
    let basis;
    if (/\.lang-logo|\.home-brand__logo/.test(sel)) {
      verdict = '제외';
      basis = '로고 "D"(장식·aria-hidden) — WCAG 1.4.3 로고 예외';
    } else if (info.overlapped) {
      verdict = '미확인';
      basis = `가운데로 옮긴 뒤에도 ${info.overlapped} 에 가려짐`;
    } else if (cssRatio !== null) {
      if (cssRatio < NEED) {
        verdict = '미달';
        basis = `CSS 합성 대비 ${cssRatio.toFixed(2)} < 4.5`;
      } else if (pix && pix.median < NEED) {
        verdict = '미확인';
        basis = `CSS 합성 ${cssRatio.toFixed(2)} 이지만 화면 픽셀 중앙값 ${pix.median.toFixed(2)}`;
      } else {
        verdict = '통과';
        basis = `단색 배경 합성(${info.layers.map((l) => l.el).join(' ← ')}) ${cssRatio.toFixed(2)}` + (pix ? `, 픽셀 중앙값 ${pix.median.toFixed(2)}` : '');
      }
    } else if (worstOverlay !== null && worstOverlay >= NEED) {
      verdict = '통과';
      basis = `반투명 배경(${info.layers.map((l) => l.el).join(',')}) 아래가 검정/흰색인 최악 합성 ${worstOverlay.toFixed(2)} (이미지: ${info.image})`;
    } else if (pix && pix.min >= NEED) {
      verdict = '통과';
      basis = `이미지·그라데이션(${info.image ?? '불투명 배경 없음'}) 위 — 글자 영역 최악 픽셀 ${pix.min.toFixed(2)}`;
    } else {
      verdict = pix && pix.min < NEED ? '미확인' : '미확인';
      basis = `이미지·그라데이션(${info.image ?? '불투명 배경 없음'}) 위 — 글자 영역 최악 픽셀 ${pix ? pix.min.toFixed(2) : '측정 불가'}`;
    }
    res.push({
      ...t,
      ...ctxInfo,
      fg: `rgba(${info.fg.r},${info.fg.g},${info.fg.b},${info.fg.a})`,
      opacity: info.opacity,
      bg: cssBg ? hex(cssBg) : info.image ? `이미지: ${info.image}` : '불투명 배경 없음',
      layers: info.layers.map((l) => `${l.el} rgba(${l.r},${l.g},${l.b},${l.a})`),
      cssRatio: cssRatio && +cssRatio.toFixed(2),
      worstOverlay: worstOverlay && +worstOverlay.toFixed(2),
      pixel: pix && { min: +pix.min.toFixed(2), p5: +pix.p5.toFixed(2), median: +pix.median.toFixed(2) },
      fontSize: info.fontSize,
      large: info.fontSize >= 24 || (info.fontWeight >= 700 && info.fontSize >= 18.66),
      ariaHidden: info.ariaHidden,
      verdict,
      basis,
    });
  }
  await style.evaluate((s) => s.remove());
  return { nodes: res, lowPasses };
}
let decoder;
async function decodeStats(png, fg, opacity) {
  return decoder.evaluate(
    async ({ b64, fg, opacity }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const lin = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const L = (r, g2, b) => 0.2126 * lin(r) + 0.7152 * lin(g2) + 0.0722 * lin(b);
      const a = fg.a * opacity;
      const out = [];
      for (let i = 0; i < d.length; i += 4) {
        const [br, bg, bb] = [d[i], d[i + 1], d[i + 2]];
        const l1 = L(fg.r * a + br * (1 - a), fg.g * a + bg * (1 - a), fg.b * a + bb * (1 - a));
        const l2 = L(br, bg, bb);
        out.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
      out.sort((x, y) => x - y);
      return { min: out[0], p5: out[Math.floor(out.length * 0.05)], median: out[Math.floor(out.length / 2)] };
    },
    { b64: png.toString('base64'), fg, opacity },
  );
}

// ── 상태 하나 검사 ──
const audits = [];
async function audit(page, lang, state, enterCheck, extra = {}) {
  const entry = { lang, state, url: page.url(), viewport: page.viewportSize(), ...extra };
  try {
    await enterCheck();
    entry.entered = true;
  } catch (e) {
    entry.entered = false;
    entry.error = String(e.message).split('\n')[0];
    audits.push(entry);
    say(`  ✗ ${lang}/${state}: 진입 실패 ${entry.error}`);
    return entry;
  }
  await page.waitForTimeout(700);
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const touch = await touchCheck(page);
  entry.axeViolations = axe.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => ({ target: n.target.join(' '), summary: n.failureSummary })),
  }));
  entry.axePassRules = axe.passes.length;
  entry.touchChecked = touch.checked;
  entry.touchExcluded = touch.excluded;
  entry.touchFails = touch.checked.filter((t) => !t.ok);
  const cv = await contrastVerdicts(page, axe, { lang, state });
  entry.contrast = cv.nodes;
  entry.contrastLowPasses = cv.lowPasses;
  const bad = entry.axeViolations.length + entry.touchFails.length + cv.lowPasses.length + cv.nodes.filter((n) => n.verdict === '미달' || n.verdict === '미확인').length;
  if (bad) await page.screenshot({ path: path.join(outDir, `T3.2_fail_${lang}_${state}.png`) });
  say(
    `  ${lang}/${state}: axe ${entry.axeViolations.length} · touch ${touch.checked.length}(미달 ${entry.touchFails.length}, 제외 ${touch.excluded.length}) · 대비노드 ${cv.nodes.length}(미달 ${cv.nodes.filter((n) => n.verdict === '미달').length}, 미확인 ${cv.nodes.filter((n) => n.verdict === '미확인').length}) · axe통과<4.5 ${cv.lowPasses.length}`,
  );
  audits.push(entry);
  return entry;
}
const vis = (page, id) => () => page.getByTestId(id).first().waitFor({ state: 'visible', timeout: 15000 });

async function newCtx(browser, lang, speech, opts = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US', ...opts });
  const page = await ctx.newPage();
  await installSpeechMock(page, speech);
  page.on('pageerror', (e) => say(`  [pageerror] ${e.message}`));
  return { ctx, page };
}

async function auditLang(browser, lang) {
  say(`[audit ${lang}]`);
  // A. 주 흐름 (음성 목: 성공)
  {
    const { ctx, page } = await newCtx(browser, lang, { stt: 'success', transcript: SSD_KO });
    await page.goto(BASE);
    await audit(page, lang, '01-lang', vis(page, 'screen-lang'));
    await page.getByTestId(`lang-${lang}`).click();
    await page.locator('.lang-start').click();
    await audit(page, lang, '02-home', vis(page, 'screen-home'));
    await page.goto(BASE + '#/order');
    await audit(page, lang, '08a-order-empty', vis(page, 'order-empty'));
    await page.goto(BASE + '#/saved');
    await audit(page, lang, '14a-saved-empty', vis(page, 'saved-empty'));
    await page.goto(BASE + '#/phrases');
    await audit(page, lang, '13-phrases', vis(page, 'screen-phrases'));
    await page.goto(BASE + '#/course');
    await audit(page, lang, '03-course-tiles', async () => {
      await page.locator('.cmap[data-mode="tiles"]').waitFor({ timeout: 15000 });
      await page.getByTestId('map-tiles').waitFor({ timeout: 15000 });
      await page.waitForTimeout(1500);
    });
    // 장소 4곳 × 탭 전부
    for (const id of ['ssd', 'eun', 'mus', 'gwc']) {
      await page.goto(BASE + `#/place/${id}`);
      await page.getByTestId('screen-place').waitFor();
      const tabs = page.locator('.place-tabs [role="tab"]');
      const n = await tabs.count();
      for (let i = 0; i < n; i++) {
        const key = ((await tabs.nth(i).getAttribute('id')) ?? `tab${i}`).replace('place-tab-', '');
        await tabs.nth(i).click();
        await audit(page, lang, `05-place-${id}-${key}`, async () => {
          await page.getByTestId('screen-place').waitFor();
          if ((await tabs.nth(i).getAttribute('aria-selected')) !== 'true') throw new Error('tab not selected');
        });
      }
      if (id === 'ssd') {
        await tabs.first().click();
        await addMenu(page, lang, 'tw', 2);
        await addMenu(page, lang, 'bu', 1);
        await audit(page, lang, '05-place-ssd-cart', vis(page, 'orderbar'));
        await page.getByRole('button', { name: tr(lang, 'report.open') }).click();
        await audit(page, lang, '07-place-reportsheet', () =>
          page.getByRole('dialog', { name: tr(lang, 'report.title') }).waitFor({ timeout: 5000 }),
        );
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 });
        await page.getByRole('button', { name: tr(lang, 'place.save') }).click();
      }
      if (id === 'gwc') {
        await tabs.first().click();
        const first = page.locator('[data-testid^="menu-"]').first();
        await first.getByRole('button', { name: tr(lang, 'menu.increase') }).click();
        await audit(page, lang, '06-place-switchsheet', () =>
          page.getByRole('dialog', { name: tr(lang, 'menu.switchTitle') }).waitFor({ timeout: 5000 }),
        );
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 });
      }
    }
    await page.goto(BASE + '#/order');
    await audit(page, lang, '08b-order-items', async () => {
      await page.getByTestId('line-tw').waitFor({ timeout: 10000 });
    });
    await page.getByRole('button', { name: tr(lang, 'order.practice') }).click();
    await audit(page, lang, '09a-practice-supported', async () => {
      await page.getByTestId('screen-practice').waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: tr(lang, 'practice.micStart') }).waitFor();
      if (await page.getByRole('button', { name: tr(lang, 'practice.micStart') }).isDisabled()) throw new Error('mic disabled');
    });
    await page.getByRole('button', { name: tr(lang, 'practice.micStart') }).click();
    await audit(page, lang, '10-result', vis(page, 'result-score'));
    await page.getByRole('button', { name: tr(lang, 'result.instead') }).click();
    await audit(page, lang, '11-staff', vis(page, 'staff-note'));
    await page.locator('[data-reply="sold"]').click();
    await audit(page, lang, '12-reply', vis(page, 'reply-ko'));
    await page.goto(BASE + '#/saved');
    await audit(page, lang, '14b-saved-items', async () => {
      await page.getByTestId('screen-saved').waitFor();
      if (await page.getByTestId('saved-empty').count()) throw new Error('saved still empty');
    });
    await page.goto(BASE + '#/settings');
    await audit(page, lang, '15a-settings', vis(page, 'screen-settings'));
    await page.getByTestId('reset-data').click();
    await audit(page, lang, '15b-settings-resetsheet', () => page.getByTestId('reset-confirm').waitFor({ timeout: 5000 }));
    await page.keyboard.press('Escape');
    if (lang === 'en') {
      // 16. 운영자 리포트 (한국어 고정) — 이벤트가 쌓인 상태, 390px·데스크톱 폭
      await page.goto(BASE + '#/report');
      await audit(page, 'ko', '16a-report-390', vis(page, 'device-events'));
      await page.setViewportSize({ width: 1280, height: 900 });
      await audit(page, 'ko', '16b-report-1280', vis(page, 'device-events'));
      await page.setViewportSize(VIEWPORT);
    }
    await ctx.close();
  }
  // B. 연습 — 음성 인식 미지원
  {
    const { ctx, page } = await newCtx(browser, lang, { stt: 'unsupported' });
    await chooseLang(page, lang);
    await page.goto(BASE + '#/place/ssd');
    await page.getByTestId('screen-place').waitFor();
    await addMenu(page, lang, 'tw', 1);
    await page.goto(BASE + '#/order');
    await page.getByRole('button', { name: tr(lang, 'order.practice') }).click();
    await audit(page, lang, '09b-practice-unsupported', async () => {
      await page.getByTestId('practice-problem').waitFor({ timeout: 10000 });
      if ((await page.getByTestId('practice-status').getAttribute('data-stt')) !== 'unsupported') throw new Error('not unsupported');
    });
    await ctx.close();
  }
  // C. 코스 SVG 약도 (오프라인)
  {
    const { ctx, page } = await newCtx(browser, lang, { stt: 'success', transcript: '' });
    await chooseLang(page, lang);
    await page.goto(BASE + '#/course');
    await page.getByTestId('screen-course').waitFor();
    await page.goto(BASE + '#/');
    await page.getByTestId('screen-home').waitFor();
    await ctx.setOffline(true);
    await page.evaluate(() => {
      location.hash = '#/course';
    });
    await audit(page, lang, '04-course-sketch', async () => {
      await page.getByTestId('map-sketch').waitFor({ timeout: 10000 });
      if ((await page.locator('.cmap').getAttribute('data-mode')) !== 'sketch') throw new Error('not sketch');
    });
    await ctx.close();
  }
  // D. 업데이트 토스트 (프록시가 sw.js 바이트를 바꿔 새 워커를 만듦)
  {
    const { ctx, page } = await newCtx(browser, lang, { stt: 'success', transcript: '' });
    swBump = false;
    await chooseLang(page, lang, PBASE);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForTimeout(1500);
    swBump = true;
    await page.reload();
    await audit(page, lang, '17-update-toast', async () => {
      await page.getByTestId('update-toast').waitFor({ timeout: 30000 });
      await page.getByTestId('screen-home').waitFor();
    });
    swBump = false;
    await ctx.close();
  }
}

let preview;
let proxy;
let browser;
const edgeProcs = [];
let failure = null;
try {
  // 메타데이터
  out.meta = {
    commit: COMMIT,
    srcAppDir: appDir,
    node: process.version,
    vite: JSON.parse(fs.readFileSync(path.join(appDir, 'node_modules/vite/package.json'), 'utf8')).version,
    playwrightCore: pkgVer('playwright-core'),
    axeCore: pkgVer('axe-core'),
    axeCorePlaywright: pkgVer('@axe-core/playwright'),
    lighthouse: pkgVer('lighthouse'),
    puppeteerCore: pkgVer('puppeteer-core'),
    fast4g: FAST4G,
    lcpObserveAfterLoadMs: LCP_OBSERVE_AFTER_LOAD_MS,
    contrastNeed: NEED,
  };
  if (!process.env.SKIP_BUILD) {
    say('build…');
    fs.rmSync(path.join(appDir, 'dist'), { recursive: true, force: true });
    const log = execSync('npm run build', { cwd: appDir, encoding: 'utf8' });
    out.meta.buildPrecacheLine = (log.match(/precache\s+\d+ entries \([^)]*\)/) ?? [null])[0];
  }
  const manifest = distManifest();
  fs.writeFileSync(path.join(outDir, 'T3.2_dist_manifest.json'), JSON.stringify({ commit: COMMIT, ...manifest }, null, 2));
  out.meta.distDigest = manifest.digest;
  out.meta.distFiles = manifest.count;
  say('dist', manifest.count, manifest.digest);

  preview = await startPreview();
  proxy = await startProxy();
  browser = await chromium.launch({ channel: 'msedge' });
  out.meta.edge = browser.version();
  decoder = await (await browser.newContext()).newPage();

  // ── (1) 첫 로드 JS = 페이지 진입 JS (SW 차단 → 프리캐시 전송 제외), 첫 화면 보일 때까지 + 1.5초 ──
  out.bundle = { definition: '페이지 진입 JS(SW·프리캐시 전송 제외): SW 차단·캐시 없음으로 첫 화면이 보일 때까지(+1.5초) 요청된 script 의 dist 파일 gzip(level 9) 합' };
  for (const scenario of ['first-visit(lang)', 'returning(home)']) {
    const ctx = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block' });
    if (scenario.startsWith('returning')) {
      const p0 = await ctx.newPage();
      await chooseLang(p0, 'en');
      await p0.close();
    }
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const js = new Set();
    page.on('request', (r) => {
      if (r.resourceType() === 'script') js.add(new URL(r.url()).pathname);
    });
    await page.goto(BASE);
    await page.getByTestId(scenario.startsWith('first') ? 'screen-lang' : 'screen-home').waitFor();
    await page.waitForTimeout(1500);
    const files = [...js].map((p) => {
      const f = path.join(appDir, 'dist', p.replace(/^\/detour\//, ''));
      return { path: p, gzip: fs.existsSync(f) ? gz(f) : null };
    });
    out.bundle[scenario] = { files, totalGzip: files.reduce((s, f) => s + (f.gzip ?? 0), 0) };
    say(scenario, out.bundle[scenario].totalGzip);
    await ctx.close();
  }

  // ── (2) Fast 4G·캐시 없음 — 판정 지표 LCP (load 후 3초 더 관측), FCP·DOM 표시는 보조 ──
  out.perf = {};
  for (const scenario of ['first-visit(lang)', 'returning(home)']) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      if (scenario.startsWith('returning')) {
        const p0 = await ctx.newPage();
        await chooseLang(p0, 'en');
        await p0.close();
      }
      const page = await ctx.newPage();
      await page.addInitScript(MARK_SCRIPT);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.setBypassServiceWorker', { bypass: true });
      await cdp.send('Network.emulateNetworkConditions', FAST4G);
      const id = scenario.startsWith('first') ? 'screen-lang' : 'screen-home';
      await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction((k) => window.__t32?.dom[k], id, { timeout: 60000 });
      await page.waitForTimeout(LCP_OBSERVE_AFTER_LOAD_MS);
      const m = await page.evaluate((k) => {
        const nav = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        return {
          lcpMs: Math.round(window.__t32.lcp) || null,
          lcpCandidates: window.__t32.lcpCount,
          lcpElement: window.__t32.lcpEl ?? null,
          lcpObservedUntilMs: Math.round(performance.now()),
          fcpMs: fcp ? Math.round(fcp.startTime) : null,
          domShownMs: Math.round(window.__t32.dom[k]),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
          loadMs: Math.round(nav.loadEventEnd),
          transferKB: Math.round(performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), nav.transferSize || 0) / 1024),
        };
      }, id);
      runs.push(m);
      say(scenario, i + 1, JSON.stringify(m));
      await ctx.close();
    }
    const med = {};
    for (const k of ['lcpMs', 'fcpMs', 'domShownMs', 'domContentLoadedMs', 'loadMs', 'transferKB']) med[k] = median(runs.map((r) => r[k] ?? 0));
    out.perf[scenario] = { runs, median: med };
  }
  // 조절 확인 (무조절 1회)
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(BASE, { waitUntil: 'load' });
    out.perf.unthrottledCheck = await page.evaluate(() => ({
      domContentLoadedMs: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
      fcpMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0),
    }));
    await ctx.close();
  }

  // ── (4)(5) 상태 목록 × 3개 언어 ──
  for (const lang of LANGS) await auditLang(browser, lang);
  out.audit = audits;
  await browser.close();
  browser = null;

  // ── (3) Lighthouse 접근성 — 13개 라우트 (en, 모바일) + /report 데스크톱 ──
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 't32-edge-'));
  const DBG = 9333;
  const edge = spawn(EDGE, [`--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  edgeProcs.push(edge);
  for (let i = 0; i < 50; i++) {
    try {
      out.meta.lighthouseBrowser = (await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json()).Browser;
      break;
    } catch {
      await sleep(300);
    }
  }
  const lhDir = path.join(outDir, 'T3.2_lh');
  fs.rmSync(lhDir, { recursive: true, force: true });
  fs.mkdirSync(lhDir, { recursive: true });
  const cdpBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${DBG}`);
  const pctx = cdpBrowser.contexts()[0];
  const page = pctx.pages()[0] ?? (await pctx.newPage());
  await installSpeechMock(page, { stt: 'success', transcript: SSD_KO });
  await chooseLang(page, 'en');
  await page.goto(BASE + '#/place/ssd');
  await page.getByTestId('screen-place').waitFor();
  await addMenu(page, 'en', 'tw', 2);
  await addMenu(page, 'en', 'bu', 1);
  await page.getByRole('button', { name: tr('en', 'place.save') }).click();
  await page.waitForTimeout(500);
  out.lighthouse = [];
  const screenOf = async () =>
    page.evaluate(() => document.querySelector('[data-testid^="screen-"]')?.getAttribute('data-testid') ?? null);
  const saveLhr = (key, r) => {
    const file = path.join(lhDir, `${key}.json`);
    fs.writeFileSync(file, r.report);
    const lhr = r.lhr;
    return {
      report: path.relative(outDir, file).split(path.sep).join('/'),
      sha256: crypto.createHash('sha256').update(r.report).digest('hex'),
      gatherMode: lhr.gatherMode,
      formFactor: lhr.configSettings.formFactor,
      screenEmulation: lhr.configSettings.screenEmulation,
      finalUrl: lhr.finalDisplayedUrl,
      score: Math.round(lhr.categories.accessibility.score * 100),
      failedAudits: Object.values(lhr.audits)
        .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
        .map((a) => a.id),
      runWarnings: lhr.runWarnings,
    };
  };
  // 내비게이션 모드: 경로로 바로 열리는 라우트. 열기 전 같은 프로필에서 실제로 그려지는 화면을 확인
  const NAV = [
    ['home', ''],
    ['course', '#/course'],
    ['place', '#/place/ssd'],
    ['order', '#/order'],
    ['staff', '#/staff'],
    ['phrases', '#/phrases'],
    ['saved', '#/saved'],
    ['settings', '#/settings'],
    ['report', '#/report'],
  ];
  for (const [key, hash] of NAV) {
    await page.goto(BASE + hash);
    await page.waitForTimeout(800);
    const rendered = await screenOf();
    const r = await lighthouse(BASE + hash, { port: DBG, output: 'json', logLevel: 'error', onlyCategories: ['accessibility'], disableStorageReset: true });
    const e = { route: key, mode: 'navigation', url: BASE + hash, rendered, ...saveLhr(`${key}-en`, r) };
    out.lighthouse.push(e);
    say(`lighthouse ${key}: ${e.score} (${rendered}) ${e.failedAudits}`);
  }
  {
    await page.goto(BASE + '#/report');
    const r = await lighthouse(BASE + '#/report', { port: DBG, output: 'json', logLevel: 'error', onlyCategories: ['accessibility'], disableStorageReset: true }, desktopConfig);
    const e = { route: 'report', mode: 'navigation-desktop', url: BASE + '#/report', rendered: 'screen-report', ...saveLhr('report-desktop', r) };
    out.lighthouse.push(e);
    say(`lighthouse report(desktop): ${e.score} ${e.failedAudits}`);
  }
  // 스냅샷 모드: 내비게이션 상태(location.state)가 있어야 열리는 practice·result·reply
  const pp = await puppeteer.connect({ browserURL: `http://127.0.0.1:${DBG}`, defaultViewport: null });
  const ppPageFor = async () => {
    await page.evaluate(() => {
      window.__t32pick = 1;
    });
    for (const p of await pp.pages()) if (await p.evaluate(() => window.__t32pick === 1).catch(() => false)) return p;
    throw new Error('puppeteer page not found');
  };
  const snap = async (key, expectTestid) => {
    const rendered = await screenOf();
    if (rendered !== expectTestid) throw new Error(`${key}: expected ${expectTestid}, got ${rendered}`);
    const p = await ppPageFor();
    const r = await lhSnapshot(p, { config: { extends: 'lighthouse:default', settings: { onlyCategories: ['accessibility'], output: 'json' } } });
    const e = { route: key, mode: 'snapshot', url: page.url(), rendered, ...saveLhr(`${key}-en`, { lhr: r.lhr, report: JSON.stringify(r.lhr) }) };
    out.lighthouse.push(e);
    say(`lighthouse ${key}(snapshot): ${e.score} ${e.failedAudits}`);
  };
  await page.goto(BASE + '#/order');
  await page.getByTestId('line-tw').waitFor();
  await page.getByRole('button', { name: tr('en', 'order.practice') }).click();
  await page.getByTestId('screen-practice').waitFor();
  await snap('practice', 'screen-practice');
  await page.getByRole('button', { name: tr('en', 'practice.micStart') }).click();
  await page.getByTestId('result-score').waitFor();
  await snap('result', 'screen-result');
  await page.getByRole('button', { name: tr('en', 'result.instead') }).click();
  await page.locator('[data-reply="sold"]').click();
  await page.getByTestId('reply-ko').waitFor();
  await snap('reply', 'screen-reply');
  await pp.disconnect();
  // 언어 선택: 마지막에 저장소 초기화(첫 실행)
  {
    const r = await lighthouse(BASE + '#/lang', { port: DBG, output: 'json', logLevel: 'error', onlyCategories: ['accessibility'], disableStorageReset: false });
    const e = { route: 'lang', mode: 'navigation(storage reset)', url: BASE + '#/lang', rendered: 'screen-lang', ...saveLhr('lang-en', r) };
    out.lighthouse.push(e);
    say(`lighthouse lang: ${e.score} ${e.failedAudits}`);
  }
  await cdpBrowser.close().catch(() => {});

  // manifest 재확인
  const after = distManifest();
  out.meta.distDigestAfter = after.digest;
  if (after.digest !== manifest.digest) throw new Error('dist manifest changed during measurement');
} catch (e) {
  failure = e;
  out.error = String(e.stack ?? e);
  console.error(e);
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const e of edgeProcs) kill(e);
  if (preview) kill(preview);
  if (proxy) proxy.close();
  out.audit ??= audits;
  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'T3.2_results.json'), JSON.stringify(out, null, 2));
  if (failure) process.exitCode = 1;
}
