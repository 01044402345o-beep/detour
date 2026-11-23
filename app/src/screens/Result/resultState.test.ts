import { scoreSpeech } from '../../domain/scoring';
import { phraseInput } from '../../router/navState';
import { parseResultState, toResultState } from './resultState';

const r = scoreSpeech('덜 맵게 해 주세요', '물 맵게 해 주세요');
if (r.status !== 'scored') throw new Error('expected scored');
const good = toResultState(phraseInput('phrase', 'gwc-2'), r);

describe('toResultState', () => {
  it('점수·목표 단어·일치 여부만 남기고 인식 조각(heard)은 버림', () => {
    expect(good).toEqual({
      nav: { src: 'phrase', phraseId: 'gwc-2' },
      score: r.score,
      words: r.words.map((w) => ({ ko: w.ko, matched: w.matched })),
      weakestIndex: r.weakestIndex,
    });
    expect(JSON.stringify(good)).not.toContain('물');
  });
});

describe('parseResultState', () => {
  it('올바른 값은 그대로', () => {
    expect(parseResultState(good)).toEqual(good);
    expect(parseResultState(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it('withOrder 표시는 phrase 입력에서만 유지', () => {
    expect(parseResultState({ ...good, nav: { ...good.nav, withOrder: true } })?.nav).toEqual({
      src: 'phrase',
      phraseId: 'gwc-2',
      withOrder: true,
    });
    expect(parseResultState({ ...good, nav: { src: 'order', withOrder: true } })?.nav).toEqual({
      src: 'order',
    });
  });

  it('추가 필드(원문 등)는 버림', () => {
    const parsed = parseResultState({
      ...good,
      transcript: 'x',
      words: [{ ...good.words[0], heard: 'y' }],
      weakestIndex: 0,
    });
    expect(parsed).not.toHaveProperty('transcript');
    expect(parsed?.words[0]).not.toHaveProperty('heard');
  });

  it.each([
    ['null', null],
    ['문자열', 'x'],
    ['nav 없음', { ...good, nav: undefined }],
    ['잘못된 phraseId', { ...good, nav: { src: 'phrase', phraseId: 'A B' } }],
    ['점수 범위 밖', { ...good, score: 101 }],
    ['점수 소수', { ...good, score: 50.5 }],
    ['단어 없음', { ...good, words: [] }],
    ['단어 형식', { ...good, words: [{ ko: 1, matched: true }] }],
    ['약한 단어가 범위 밖', { ...good, weakestIndex: 9 }],
    ['약한 단어가 일치 단어', { ...good, weakestIndex: 1 }],
  ])('%s → null', (_name, v) => {
    expect(parseResultState(v)).toBeNull();
  });
});

describe('groupByUnits·toResultState(units) — 학습 단위로 묶기 (R1 L-01)', () => {
  const ORDER = '튀김소보로 두 개, 판타롱부추빵 한 개 주세요.';
  const UNITS = ['튀김소보로', '두 개', '판타롱부추빵', '한 개', '주세요'];
  const sc = (target: string, heard: string) => {
    const x = scoreSpeech(target, heard);
    if (x.status !== 'scored') throw new Error('expected scored');
    return x;
  };
  const nav = phraseInput('order');

  it("'두 개' 완전 일치 → 한 칩 ok", () => {
    const s = toResultState(nav, sc('두 개 주세요', '두 개 주세요'), ['두 개', '주세요']);
    expect(s.words).toEqual([
      { ko: '두 개', matched: true },
      { ko: '주세요', matched: true },
    ]);
    expect(s.weakestIndex).toBeNull();
  });

  it("'두 개' → '두'(개 누락) → '두 개' 칩 ng + 약한 단위", () => {
    const s = toResultState(nav, sc('두 개 주세요', '두 주세요'), ['두 개', '주세요']);
    expect(s.words[0]).toEqual({ ko: '두 개', matched: false });
    expect(s.words[1].matched).toBe(true);
    expect(s.weakestIndex).toBe(0);
  });

  it("'두 개' → '세 개' → ng", () => {
    const s = toResultState(nav, sc('두 개 주세요', '세 개 주세요'), ['두 개', '주세요']);
    expect(s.words[0]).toEqual({ ko: '두 개', matched: false });
    expect(s.weakestIndex).toBe(0);
  });

  it('수량이 두 번 나오는 주문 → 각 단위가 자기 구간만 반영', () => {
    const s = toResultState(nav, sc(ORDER, '튀김소보로 두 개 판타롱부추빵 세 개 주세요'), UNITS);
    expect(s.words.map((w) => [w.ko, w.matched])).toEqual([
      ['튀김소보로', true],
      ['두 개', true],
      ['판타롱부추빵', true],
      ['한 개', false],
      ['주세요', true],
    ]);
    expect(s.weakestIndex).toBe(3);
    expect(parseResultState(s)).toEqual(s);
  });

  it('단위 토큰 수가 맞지 않으면 채점 토큰 단위로 대비', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const x = sc('두 개 주세요', '두 주세요');
    const s = toResultState(nav, x, ['두 개 주세요 더']);
    expect(s.words.map((w) => w.ko)).toEqual(['두', '개', '주세요']);
    expect(s.weakestIndex).toBe(x.weakestIndex);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
