import { bundles } from '.';
import { LANGS } from '../types';
import { COURSE_GUIDES, PLACE_GUIDES, type GuideText } from './guides';

const all = (g: GuideText) => LANGS.flatMap((l) => g[l].flat());

describe('음성 가이드 원고 (T6.14)', () => {
  it('모든 코스·모든 정류장에 원고가 있고, 원고 키는 실제 코스·장소만', () => {
    const courseIds = bundles.map((b) => b.course.id);
    const placeIds = bundles.flatMap((b) => b.course.stops);
    expect(Object.keys(COURSE_GUIDES).sort()).toEqual([...courseIds].sort());
    expect(Object.keys(PLACE_GUIDES).sort()).toEqual([...placeIds].sort());
  });

  const entries = [
    ...Object.entries(COURSE_GUIDES).map(([id, g]) => [`course ${id}`, g] as const),
    ...Object.entries(PLACE_GUIDES).map(([id, g]) => [`place ${id}`, g] as const),
  ];

  it.each(entries)('%s: 영어·일본어·중국어 모두, 빈 문단·빈 문장 없음, 세 언어 문단 수 같음', (_id, g) => {
    for (const l of LANGS) {
      expect(g[l].length).toBeGreaterThan(0);
      for (const p of g[l]) {
        expect(p.length).toBeGreaterThan(0);
        for (const s of p) expect(s.trim().length).toBeGreaterThan(0);
      }
    }
    expect(g.ja.length).toBe(g.en.length);
    expect(g.zh.length).toBe(g.en.length);
  });

  it.each(entries)('%s: 한글 없음 (영어·일본어·중국어 음성은 한글을 못 읽음)', (_id, g) => {
    for (const s of all(g)) expect(s).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
  });

  it.each(entries)('%s: 문장 끝 문장부호 / 가격·통화 숫자를 말하지 않음', (_id, g) => {
    for (const s of g.en.flat()) expect(s).toMatch(/[.!?]$/);
    for (const s of [...g.ja.flat(), ...g.zh.flat()]) expect(s).toMatch(/[。！？]$/);
    for (const s of all(g)) expect(s).not.toMatch(/₩|\bwon\b|ウォン|韩元|韓元|\d+\s*원/i);
  });

  it.each(entries)('%s: 현장 확인 전(예시 정보) 안내 — 세 언어, 예외 없음 (R1 M-04)', (_id, g) => {
    expect(g.en.flat().some((s) => /sample information/.test(s))).toBe(true);
    expect(g.ja.flat().some((s) => /参考例/.test(s) && /まだ確認できて/.test(s))).toBe(true);
    expect(g.zh.flat().some((s) => /示例信息/.test(s))).toBe(true);
  });

  it('데이터보다 강한 주장(인기 순위·방문 동기·종일 운영 단정)을 쓰지 않음 (R1 M-04·L-03)', () => {
    const text = Object.values({ ...COURSE_GUIDES, ...PLACE_GUIDES }).flatMap((g) => all(g)).join(' ');
    expect(text).not.toMatch(/most visitors|favorite for|一番人気|お目当て|最受欢迎|大多数人|open all day|一日中|全天|例の情報/i);
  });

  it('중국어는 간체(번체 전용 글자 없음), 일본어는 가나 포함', () => {
    const zh = Object.values({ ...COURSE_GUIDES, ...PLACE_GUIDES }).flatMap((g) => g.zh.flat());
    for (const s of zh) expect(s).not.toMatch(/[們這個來說時為與廳館點飯麵湯銀]/);
    const ja = Object.values({ ...COURSE_GUIDES, ...PLACE_GUIDES }).flatMap((g) => g.ja.flat());
    expect(ja.every((s) => /[぀-ヿ]/.test(s))).toBe(true);
  });
});
