// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findHardcoded, isScanned } from './hardcodeCheck';

const check = (src: string, file = 'src/screens/X.tsx') =>
  findHardcoded(src, file).map((v) => v.text);

describe('findHardcoded 규칙', () => {
  it('JSX 영어 텍스트를 잡는다', () => {
    expect(check('export const A = () => <button>Show to staff</button>;')).toEqual([
      'Show to staff',
    ]);
  });

  it('보이는 속성값을 잡고 className 등은 넘긴다', () => {
    expect(check('const A = () => <img alt="Map" className="map big" data-testid="x" />;')).toEqual(
      ['Map'],
    );
    expect(check('const A = () => <button aria-label={"Close"} />;')).toEqual(['Close']);
  });

  it('JSX 자식 표현식 안의 조건식·템플릿 문자열을 잡는다', () => {
    expect(
      check("const A = ({ ok }: { ok: boolean }) => <p>{ok ? 'Great' : 'Almost'}</p>;"),
    ).toEqual(['Great', 'Almost']);
    expect(check('const A = ({ n }: { n: number }) => <p>{`${n} items`}</p>;')).toEqual(['items']);
  });

  it('어디에 있든 한글·가나·한자 문자열을 잡는다', () => {
    expect(check("const msg = '주문 수정';", 'src/ui/x.ts')).toEqual(['주문 수정']);
    expect(check("const msg = '注文を変更';", 'src/ui/x.ts')).toEqual(['注文を変更']);
    expect(check('const A = () => <p>修改点单</p>;')).toEqual(['修改点单']);
  });

  it('예외 목록(직원 고정 문구·상호명·언어 이름·단위)과 기호·숫자는 허용한다', () => {
    expect(
      check("const A = () => <><b>네</b><b>{'품절이에요'}</b><b>성심당</b><b>日本語</b></>;"),
    ).toEqual([]);
    expect(check("const u = c === '인분';", 'src/ui/x.ts')).toEqual([]);
    expect(check('const A = () => <p>🐢 0.75× · → ₩{1000}</p>;')).toEqual([]);
    expect(check('const A = () => <h1>Edulleo</h1>;')).toEqual([]);
  });

  it('t() 호출·import 경로·타입 리터럴·비가시 문자열은 넘긴다', () => {
    const src = [
      "import { useT } from '../i18n';",
      "type U = '개' | '공기';",
      "const route = '/course';",
      "const A = () => { const t = useT(); return <p className='x'>{t('nav.course')}</p>; };",
    ].join('\n');
    expect(check(src)).toEqual([]);
  });

  it('검사 대상·예외 경로를 구분한다', () => {
    expect(isScanned('src/screens/Home.tsx')).toBe(true);
    expect(isScanned('src/ui/format.ts')).toBe(true);
    expect(isScanned('src/App.tsx')).toBe(true);
    expect(isScanned('src/screens/Home.test.tsx')).toBe(false);
    expect(isScanned('src/i18n/index.ts')).toBe(false);
    expect(isScanned('src/domain/orderSentence.ts')).toBe(false);
    expect(isScanned('src/data/downtown.json')).toBe(false);
    // R1 M-2: src 전체 .ts로 확장
    expect(isScanned('src/store/useAppStore.ts')).toBe(true);
    expect(isScanned('src/hooks/useToast.ts')).toBe(true);
    expect(isScanned('src/speech/stt.ts')).toBe(true);
  });
});

describe('R1 M-2 회귀: 변수·속성·hook 경로', () => {
  it('A: 지역 변수에 둔 문장형 영어 → 위반', () => {
    expect(
      check("const A = () => { const label = 'Show to staff'; return <button>{label}</button>; };"),
    ).toEqual(['Show to staff']);
  });

  it('B: submit 버튼의 value → 위반 (한 단어도)', () => {
    expect(check("const B = () => <input type='submit' value='Pay now' />;")).toEqual(['Pay now']);
    expect(check("const B = () => <input type='button' value='Close' />;")).toEqual(['Close']);
    expect(check("const B = () => <option value='Close'>{x}</option>;")).toEqual(['Close']);
  });

  it('폼 상태값 value(text input)의 한 단어는 넘긴다', () => {
    expect(check("const B = () => <input type='text' value='ssd' readOnly />;")).toEqual([]);
  });

  it('C: 배열의 한 단어 영어(Open/Closed)는 의도적으로 통과 — Phase 2 E2E 5가 맡음', () => {
    expect(check("const C = () => <p>{['Open', 'Closed'].join(' / ')}</p>;")).toEqual([]);
  });

  it('hook·helper의 토스트 문구(한국어·문장형 영어) → 위반', () => {
    const src = ["toast('저장했어요');", "toast('Saved to your list.');"].join('\n');
    expect(check(src, 'src/hooks/useToast.ts')).toEqual(['저장했어요', 'Saved to your list.']);
  });

  it('객체 값·함수 인자·템플릿의 문장형 영어 → 위반', () => {
    expect(check("const m = { ok: 'Your order is ready' };", 'src/store/x.ts')).toEqual([
      'Your order is ready',
    ]);
    expect(check('const f = (n: number) => `Saved ${n} items.`;', 'src/store/x.ts')).toEqual([
      'Saved ${…} items.',
    ]);
  });

  it('오탐 방지: className·경로·이벤트 이름·console·Error·브랜드는 넘긴다', () => {
    const src = [
      "const A = () => <div className='flex gap-2'>{x}</div>;",
      "navigate('/place/ssd');",
      "logEvent({ type: 'place_view' });",
      "console.warn('Missing key x.');",
      "throw new Error('Store is not ready.');",
      "const name = 'Edulleo';",
      "const lang = 'ko-KR';",
    ].join('\n');
    expect(check(src)).toEqual([]);
  });
});

describe('저장소 검사: 예외 목록 밖 하드코딩 문구 없음', () => {
  const appRoot = fileURLToPath(new URL('../..', import.meta.url));
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  it('src/의 화면 파일에 하드코딩 문구가 없다', () => {
    const files = walk(join(appRoot, 'src'))
      .map((f) => ({ full: f, rel: relative(appRoot, f).replace(/\\/g, '/') }))
      .filter((f) => isScanned(f.rel));
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((f) => findHardcoded(readFileSync(f.full, 'utf8'), f.rel));
    expect(violations.map((v) => `${v.file}:${v.line} ${v.text}`)).toEqual([]);
  });
});
