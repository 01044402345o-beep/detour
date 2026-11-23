// T3.2 대비 노드별 최종 판정표 만들기 (M-02)
// 사용: node reviews/T3.2_verdicts.mjs reviews
// 입력: T3.2_results.json (T3.2_measure.mjs 자동 판정) → 출력: T3.2_contrast.json (verdicts·groups·summary)
// 자동 판정이 '미확인'으로 남긴 노드 중 SVG 약도 글자만 아래 수동 판정(약도 SVG 소스의 고정 색으로 계산)으로 바꿉니다.
// 수동 판정 근거 색: app/src/ui/map/sketchConstants.ts SKETCH_BG (5f88faa; 9a5c5f4 의 SketchMap.tsx 값과 같음) — 배경 rect #f1ebde, 블록 #e8e0cf, 하천 stroke #bcd9e6,
//   도로 stroke #fff, 핀 원 fill var(--acc-d)#b3461c / var(--plum)#6b4fc6 + 흰 stroke 3.5
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? 'reviews');
const r = JSON.parse(fs.readFileSync(path.join(dir, 'T3.2_results.json'), 'utf8'));

const hex = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
const lin = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const L = (c) => {
  const [a, b, d] = hex(c);
  return 0.2126 * lin(a) + 0.7152 * lin(b) + 0.0722 * lin(d);
};
const ratio = (a, b) => {
  const x = L(a);
  const y = L(b);
  return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2);
};
const SKETCH_BG = { '배경 #f1ebde': '#f1ebde', '블록 #e8e0cf': '#e8e0cf', '하천 #bcd9e6': '#bcd9e6', '도로 #ffffff': '#ffffff' };
const sketchAll = (fg) => Object.entries(SKETCH_BG).map(([k, v]) => `${k} ${ratio(fg, v)}`).join(', ');
const sketchMin = (fg) => Math.min(...Object.values(SKETCH_BG).map((v) => ratio(fg, v)));

function manual(n, state) {
  if (!state.startsWith('04-course-sketch') || !n.target.startsWith('text')) return null;
  if (n.fg === 'rgba(255,255,255,1)') {
    const food = Math.abs((n.pixel?.median ?? 0) - 5.51) < 0.2;
    const fill = food ? '#b3461c' : '#6b4fc6';
    return {
      verdict: '통과',
      bg: `${fill} (핀 원 fill)`,
      ratioUsed: ratio('#ffffff', fill),
      basis: `SVG 핀 번호(aria-hidden): 흰 글자 / 원 채움 ${food ? '--acc-d' : '--plum'} ${fill} = ${ratio('#ffffff', fill)}. 글자 상자 픽셀 중앙값 ${n.pixel?.median}(=채움색), 최악 픽셀 1.0 은 캡처에 남은 흰 글자(SVG fill 은 투명화되지 않음)·흰 테두리 픽셀 — 판정에 쓰지 않음`,
    };
  }
  // 흰색이 아닌 약도 글자: 글자색(실측 fill)으로 약도 바탕 4종 전부와 계산 → 최저값으로 판정
  const m = n.fg.match(/[\d.]+/g).map(Number);
  const fgHex = '#' + m.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const name = n.target.includes('x="323"') ? '하천 이름(9px, 회전)' : n.target.includes('x="352"') ? '"대전역 방향" 글자(9px)' : `약도 글자 ${n.target}`;
  const worst = sketchMin(fgHex);
  return {
    verdict: worst >= 4.5 ? '통과' : '미달',
    bg: '약도 바탕 4종(최악 기준)',
    ratioUsed: worst,
    basis: `${name}, 글자 ${fgHex}: ${sketchAll(fgHex)} — 최저 ${worst} ${worst >= 4.5 ? '≥' : '<'} 4.5`,
  };
  return null;
}

const verdicts = [];
for (const a of r.audit) {
  for (const n of a.contrast ?? []) {
    const m = manual(n, a.state);
    verdicts.push({
      lang: a.lang,
      state: a.state,
      selector: n.target,
      source: n.source,
      axeReason: n.reason,
      fg: n.fg,
      bg: m?.bg ?? n.bg,
      layers: n.layers,
      cssRatio: n.cssRatio ?? null,
      worstOverlay: n.worstOverlay ?? null,
      pixel: n.pixel ?? null,
      ratioUsed: m?.ratioUsed ?? (/최악 픽셀/.test(n.basis) ? n.pixel?.min : /최악 합성/.test(n.basis) ? n.worstOverlay : n.cssRatio) ?? null,
      fontSize: n.fontSize,
      large: n.large,
      ariaHidden: n.ariaHidden,
      verdict: m?.verdict ?? n.verdict,
      basis: m?.basis ?? n.basis,
      decidedBy: m ? 'manual(SVG 약도 소스 색)' : 'script',
    });
  }
}
// 같은 종류(언어별 aria-label·nth-child 차이 제거) 묶음
const norm = (s) => s.replace(/\[aria-label="[^"]*"\]/g, '[aria-label]').replace(/:nth-child\(\d+\)/g, '');
const groups = {};
for (const v of verdicts) {
  const k = `${v.verdict}|${norm(v.selector)}|${v.fg}|${v.bg}`;
  const g = (groups[k] ??= { verdict: v.verdict, selector: norm(v.selector), fg: v.fg, bg: v.bg, count: 0, states: new Set(), langs: new Set(), ratioMin: Infinity, ratioMax: -Infinity, pixelP5Min: Infinity, basis: v.basis, decidedBy: v.decidedBy });
  g.count++;
  g.states.add(v.state.replace(/^(\d+[ab]?)-.*/, '$1'));
  g.langs.add(v.lang);
  if (v.ratioUsed != null) {
    g.ratioMin = Math.min(g.ratioMin, v.ratioUsed);
    g.ratioMax = Math.max(g.ratioMax, v.ratioUsed);
  }
  if (v.pixel) g.pixelP5Min = Math.min(g.pixelP5Min, v.pixel.p5);
}
const groupList = Object.values(groups).map((g) => ({ ...g, states: [...g.states].sort(), langs: [...g.langs].sort(), pixelP5Min: g.pixelP5Min === Infinity ? null : g.pixelP5Min }));
const summary = {};
for (const v of verdicts) summary[v.verdict] = (summary[v.verdict] ?? 0) + 1;
const out = {
  commit: r.meta.commit,
  distDigest: r.meta.distDigest,
  need: 4.5,
  totalNodes: verdicts.length,
  summary,
  passWithPixelP5Below45: verdicts.filter((v) => v.verdict === '통과' && v.pixel && v.pixel.p5 < 4.5).length,
  axePassesBelow45: r.audit.reduce((s, a) => s + (a.contrastLowPasses?.length ?? 0), 0),
  groups: groupList,
  verdicts,
};
fs.writeFileSync(path.join(dir, 'T3.2_contrast.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ totalNodes: out.totalNodes, summary, groups: groupList.length, passWithPixelP5Below45: out.passWithPixelP5Below45, axePassesBelow45: out.axePassesBelow45 }));
for (const g of groupList.filter((g) => g.verdict !== '통과' || g.decidedBy !== 'script' || (g.pixelP5Min !== null && g.pixelP5Min < 4.5)))
  console.log([g.verdict, g.count, g.selector, g.fg, g.bg, g.ratioMin, g.pixelP5Min, g.states.join(','), g.langs.join(','), g.basis].join(' ¦ '));
