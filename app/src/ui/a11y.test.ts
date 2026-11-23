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
