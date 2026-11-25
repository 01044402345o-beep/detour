// @vitest-environment node
/**
 * PRD 7장 접근성 검사 (T2.0 완료 조건): 대비 4.5:1, 터치 영역 44px.
 * tokens.css·ui.css를 직접 읽어 a11y.ts의 표와 대조합니다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  COLOR_PAIRS,
  MIN_CONTRAST,
  MIN_TOUCH_PX,
  TOUCH_SELECTORS,
  contrastRatio,
  parseRules,
  parseTokens,
  resolveColor,
  resolvePx,
} from './a11y';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const tokens = parseTokens(read('../styles/tokens.css'));
const rules = parseRules(read('../styles/ui.css'));
const globalRules = parseRules(read('../styles/global.css'));

const BG_PROPS = ['background', 'background-color'];

describe('계산 함수', () => {
  it('WCAG 대비 비율', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
    // 목업 원래 값이 기준 미달이었던 조합 (조정 근거)
    expect(contrastRatio('#ffffff', '#ee6a3c')).toBeLessThan(MIN_CONTRAST);
    expect(contrastRatio('#c24e22', '#fde6dc')).toBeLessThan(MIN_CONTRAST);
    expect(contrastRatio('#6b7287', '#fbf7ef')).toBeLessThan(MIN_CONTRAST);
  });

  it('CSS 읽기', () => {
    const r = parseRules('.a{color:red}@media (x){.a{color:blue}}.a,.b{min-height:var(--t)}');
    expect(r.get('.a')?.get('color')).toBe('red');
    expect(r.get('.b')?.get('min-height')).toBe('var(--t)');
    expect(resolvePx('var(--t)', new Map([['--t', '44px']]))).toBe(44);
    expect(resolveColor('var(--a)', new Map([['--a', '#123456']]))).toBe('#123456');
  });
});

describe('대비 4.5:1 이상 (PRD 7장)', () => {
  for (const p of COLOR_PAIRS) {
    it(`${p.selector}: ${p.fg} on ${p.bg}`, () => {
      const fg = resolveColor(p.fg, tokens);
      const bg = resolveColor(p.bg, tokens);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });
  }

  it('표의 색이 실제 CSS 선언과 같음 (표와 CSS가 어긋나지 않게)', () => {
    for (const p of COLOR_PAIRS) {
      if (/^(compat|state):/.test(p.selector)) continue; // CSS 규칙 없는 토큰 조합
      const decl = rules.get(p.selector) ?? globalRules.get(p.selector);
      expect(decl, `${p.selector} 규칙 없음`).toBeDefined();
      const color = decl!.get('color');
      if (color)
        expect(resolveColor(color, tokens), `${p.selector} color`).toBe(resolveColor(p.fg, tokens));
      const bgProp = BG_PROPS.find((k) => decl!.has(k));
      const bgVal = bgProp ? decl!.get(bgProp)! : null;
      // 단색 배경만 비교 (그라데이션·반투명은 표의 근사값을 씀)
      if (bgVal && /^(#[0-9a-f]{3,6}|var\(--[\w-]+\))$/i.test(bgVal)) {
        expect(resolveColor(bgVal, tokens), `${p.selector} background`).toBe(
          resolveColor(p.bg, tokens),
        );
      }
    }
  });

  it('ui.css에서 글자색을 정한 규칙은 모두 표에 있음', () => {
    const listed = new Set(COLOR_PAIRS.map((p) => p.selector));
    const missing = [...rules]
      .filter(([, decl]) => decl.has('color') && decl.get('color') !== 'inherit')
      .map(([sel]) => sel)
      .filter((sel) => !listed.has(sel));
    expect(missing).toEqual([]);
  });
});

describe('DESIGN.md 2장 토큰 (T6.0)', () => {
  const DESIGN_TOKENS: Record<string, string> = {
    '--ground': '#f4f7fb',
    '--surface': '#ffffff',
    '--line': '#dce3ee',
    '--ink': '#0f1b33',
    '--mute': '#55627a',
    '--blue': '#1d5bd6',
    '--blue-deep': '#0e3a8f',
    '--tint': '#e6eefb',
    '--on-blue': '#ffffff',
    '--signal': '#ffb21a',
    '--ok': '#17703d',
    '--danger': '#b42318',
  };

  it('새 토큰 값이 DESIGN.md와 같음', () => {
    for (const [name, hex] of Object.entries(DESIGN_TOKENS)) {
      expect(resolveColor(name as `--${string}`, tokens).toLowerCase(), name).toBe(hex);
    }
  });

  it('옛 강조색 이름은 파랑·중립으로 대응 (주황·청록·보라·금색 값 없음)', () => {
    const palette = new Set(Object.values(DESIGN_TOKENS));
    for (const old of [
      '--acc',
      '--acc-d',
      '--acc-s',
      '--sea',
      '--sea-d',
      '--sea-s',
      '--plum',
      '--plum-s',
      '--paper',
      '--card',
      '--soft',
      '--ink2',
      '--line2',
    ]) {
      expect(palette.has(resolveColor(old as `--${string}`, tokens).toLowerCase()), old).toBe(true);
    }
  });

  it('공용 스타일에 굵기 800·900 없음 (DESIGN.md 3장)', () => {
    for (const f of [
      '../styles/ui.css',
      '../styles/global.css',
      './ReportSheet.css',
      '../sw/updateToast.css',
    ]) {
      expect(read(f), f).not.toMatch(/font-weight:\s*(800|900)/);
    }
  });

  it('글꼴: Fraunces 없음, 숫자는 IBM Plex Mono', () => {
    expect(tokens.get('--dfont')).not.toMatch(/Fraunces/);
    expect(tokens.get('--sans')).toBe('var(--sans-ko)');
    expect(tokens.get('--num')).toBe('var(--num-ko)');
    for (const l of ['ko', 'ja', 'zh']) {
      expect(tokens.get(`--sans-${l}`)).toMatch(/^'Pretendard Variable'/);
      expect(tokens.get(`--num-${l}`)).toMatch(/^'IBM Plex Mono'/);
    }
  });

  it('JA·ZH 글꼴 스택에 맑은 고딕 없음, 숫자 스택은 monospace 앞에 언어 글꼴 (T6.7 M-01·M-02)', () => {
    expect(tokens.get('--sans-ko')).toMatch(/'Malgun Gothic'/);
    for (const l of ['ja', 'zh']) {
      expect(tokens.get(`--sans-${l}`)).not.toMatch(/Malgun/);
      expect(tokens.get(`--num-${l}`)).not.toMatch(/Malgun/);
    }
    expect(tokens.get('--sans-ja')).toMatch(/'Hiragino Sans'[\s\S]*'Yu Gothic UI'[\s\S]*Meiryo/);
    expect(tokens.get('--sans-zh')).toMatch(/'PingFang SC'[\s\S]*'Microsoft YaHei'/);
    expect(tokens.get('--num-ja')).toMatch(/'Yu Gothic UI'[\s\S]*monospace$/);
    expect(tokens.get('--num-zh')).toMatch(/'Microsoft YaHei'[\s\S]*monospace$/);
    // lang 속성 요소에서 언어별 변수를 고름(html에도 적용되게 :root보다 높은 명시도),
    // font-family는 :where(명시도 0)라 화면 CSS가 이김
    const g = read('../styles/global.css');
    expect(g).toMatch(/\n\[lang\]:lang\(ja\)\s*\{[^}]*--sans:\s*var\(--sans-ja\)/);
    expect(g).toMatch(/\n\[lang\]:lang\(zh\)\s*\{[^}]*--sans:\s*var\(--sans-zh\)/);
    expect(g).toMatch(/:where\(\[lang\]\)\s*\{\s*font-family:\s*var\(--sans\);/);
  });
});

describe('터치 영역 44px 이상 (PRD 7장)', () => {
  for (const sel of TOUCH_SELECTORS) {
    it(`${sel}: min-width·min-height`, () => {
      const decl = rules.get(sel);
      expect(decl, `${sel} 규칙 없음`).toBeDefined();
      expect(resolvePx(decl!.get('min-height'), tokens)).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
      expect(resolvePx(decl!.get('min-width'), tokens)).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });
  }

  it('--touch 토큰 = 44px', () => {
    expect(resolvePx('var(--touch)', tokens)).toBe(44);
  });
});
