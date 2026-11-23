/**
 * 접근성 검사 기준 (PRD 7장, T2.0 완료 조건). a11y.test.ts가 tokens.css·ui.css와 대조합니다.
 * - 새 글자/배경 색 조합을 ui.css에 쓰면 COLOR_PAIRS에 추가하세요(4.5:1 이상이어야 통과).
 * - 누를 수 있는 공용 요소의 클래스는 TOUCH_SELECTORS에 두고 min-width·min-height 44px 이상.
 * 앱 번들에는 들어가지 않습니다(테스트 전용).
 */

/** 색 값: 토큰 이름('--ink') 또는 #hex */
export type ColorRef = `--${string}` | `#${string}`;

export type ColorPair = {
  /** ui.css 선택자. 그 규칙에 color/background가 있으면 이 표와 같은지도 검사 */
  selector: string;
  fg: ColorRef;
  bg: ColorRef;
};

export const MIN_CONTRAST = 4.5;
export const MIN_TOUCH_PX = 44;

export const COLOR_PAIRS: readonly ColorPair[] = [
  // 기본 글자
  { selector: 'body', fg: '--ink', bg: '--paper' },
  { selector: '.ui-card', fg: '--ink', bg: '--card' },
  // 버튼
  { selector: '.ui-btn--ink', fg: '#fff', bg: '--ink' },
  { selector: '.ui-btn--acc', fg: '#fff', bg: '--acc-d' },
  { selector: '.ui-btn--sea', fg: '#fff', bg: '--sea' },
  { selector: '.ui-btn--ghost', fg: '--ink', bg: '#fff' },
  { selector: '.ui-icb', fg: '--ink', bg: '#fff' },
  // 알약
  { selector: '.ui-pill--acc', fg: '--acc-d', bg: '--acc-s' },
  { selector: '.ui-pill--sea', fg: '--sea-d', bg: '--sea-s' },
  { selector: '.ui-pill--plum', fg: '--plum', bg: '--plum-s' },
  { selector: '.ui-pill--ink', fg: '#fff', bg: '--ink' },
  { selector: '.ui-pill--line', fg: '--ink2', bg: '#fff' },
  // 탭바 (배경 흰색 96% — 흰색으로 계산)
  { selector: '.ui-tab', fg: '--soft', bg: '#fff' },
  { selector: ".ui-tab[aria-current='page']", fg: '--acc-d', bg: '#fff' },
  // 토스트·시트
  { selector: '.ui-toast', fg: '#fff', bg: '--ink' },
  { selector: '.ui-sheet', fg: '--ink', bg: '--paper' },
  // 듣기·발음
  { selector: '.ui-listen', fg: '--sea-d', bg: '--paper' },
  { selector: '.ui-listen', fg: '--sea-d', bg: '--card' },
  { selector: '.ui-listen--round', fg: '--sea-d', bg: '--sea-s' },
  { selector: '.ui-listen--pill', fg: '--sea-d', bg: '--sea-s' },
  { selector: ".ui-listen[aria-pressed='true']", fg: '#fff', bg: '--sea' },
  { selector: '.ui-listen-notice', fg: '--acc-d', bg: '--paper' },
  { selector: '.ui-listen-notice', fg: '--acc-d', bg: '--card' },
  { selector: '.ui-pron', fg: '--soft', bg: '--paper' },
  { selector: '.ui-pron', fg: '--soft', bg: '--card' },
];

/** 누를 수 있는 공용 요소 클래스 (min-width·min-height ≥ 44px) */
export const TOUCH_SELECTORS: readonly string[] = [
  '.ui-btn',
  '.ui-icb',
  '.ui-tab',
  '.ui-card--action',
  '.ui-listen',
];

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** #rgb·#rrggbb → 상대 휘도 (WCAG 2.x) */
export function luminance(hex: string): number {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`bad hex color: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 대비 비율 (1~21) */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** CSS 텍스트에서 `--name: value;` 토큰 읽기 (주석 제거) */
export function parseTokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

/** CSS 텍스트 → 선택자별 선언 (같은 선택자는 합침, @keyframes·@media 안은 건너뜀) */
export function parseRules(css: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  let buf = '';
  while (i < clean.length) {
    const ch = clean[i];
    if (ch === '{') {
      const head = buf.trim();
      const close = clean.indexOf('}', i);
      const inner = clean.slice(i + 1, close);
      if (head.startsWith('@') || inner.includes('{')) {
        // at-rule 블록: 짝이 맞는 닫는 괄호까지 건너뜀
        let d = 1;
        let j = i + 1;
        while (j < clean.length && d > 0) {
          if (clean[j] === '{') d++;
          else if (clean[j] === '}') d--;
          j++;
        }
        i = j;
        buf = '';
        continue;
      }
      const decls = new Map<string, string>();
      for (const part of inner.split(';')) {
        const k = part.indexOf(':');
        if (k > 0) decls.set(part.slice(0, k).trim(), part.slice(k + 1).trim());
      }
      for (const sel of head.split(',').map((s) => s.trim())) {
        const prev = out.get(sel) ?? new Map<string, string>();
        decls.forEach((v, key) => prev.set(key, v));
        out.set(sel, prev);
      }
      i = close + 1;
      buf = '';
      continue;
    }
    buf += ch;
    i++;
  }
  return out;
}

/** 'var(--x)'·'--x'·'#hex'·'#fff' → #hex (토큰이 다른 토큰을 가리키면 따라감) */
export function resolveColor(ref: string, tokens: Map<string, string>): string {
  let v = ref.trim();
  for (let n = 0; n < 5; n++) {
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    const name = m ? m[1] : v.startsWith('--') ? v : null;
    if (!name) break;
    const next = tokens.get(name);
    if (next === undefined) throw new Error(`unknown token ${name}`);
    v = next;
  }
  return v;
}

/** '44px'·'var(--touch)' → px 숫자 (모르면 NaN) */
export function resolvePx(value: string | undefined, tokens: Map<string, string>): number {
  if (!value) return NaN;
  let v = value.trim();
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  if (m) v = tokens.get(m[1]) ?? '';
  const px = /^(\d+(?:\.\d+)?)px$/.exec(v.trim());
  return px ? Number(px[1]) : NaN;
}
