import type { Counter, MenuItem } from '../types';
import { buildOrderSentence, toOrderLines } from './orderSentence';

function menu(
  id: string,
  ko: string,
  roman: string,
  kana: string,
  counter: Counter,
  name: MenuItem['name'],
): MenuItem {
  return { id, ko, roman, kana, counter, name, verified: true, allergenStatus: 'unknown' };
}

// 목업 데이터 기준 fixture
const soboro = menu('tw', '튀김소보로', 'twigim soboro', 'トィギム ソボロ', '개', {
  en: 'Fried Soboro',
  ja: '揚げソボロパン',
  zh: '炸酥粒面包',
});
const chive = menu('bu', '판타롱부추빵', 'pantarong buchuppang', 'パンタロン ブチュッパン', '개', {
  en: 'Pantarong Chive Bread',
  ja: 'パンタロン ニラパン',
  zh: '韭菜面包',
});
const tofu = menu('dt', '두부두루치기', 'dubu duruchigi', 'トゥブ トゥルチギ', '인분', {
  en: 'Spicy Braised Tofu',
  ja: '豆腐トゥルチギ',
  zh: '辣炒豆腐',
});
const rice = menu('rc', '밥', 'bap', 'パプ', '공기', { en: 'Rice', ja: 'ご飯', zh: '米饭' });

/** 문장부호(, . 、 。)를 빼고 공백 정리 */
const strip = (s: string) =>
  s
    .replace(/[,.、。]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('buildOrderSentence — 매장/포장', () => {
  it('한 품목 · 매장', () => {
    const s = buildOrderSentence([{ item: soboro, qty: 2 }], false);
    expect(s).toEqual({
      ko: '튀김소보로 두 개 주세요.',
      roman: 'twigim soboro du gae juseyo.',
      kana: 'トィギム ソボロ トゥ ゲ ジュセヨ。',
      meaning: {
        en: 'Fried Soboro ×2, please.',
        ja: '揚げソボロパン ×2 をください。',
        zh: '请给我炸酥粒面包 ×2。',
      },
      words: [
        { ko: '튀김소보로', roman: 'twigim soboro', kana: 'トィギム ソボロ', meaning: soboro.name },
        {
          ko: '두 개',
          roman: 'du gae',
          kana: 'トゥ ゲ',
          meaning: { en: '× 2', ja: '× 2', zh: '× 2' },
        },
        {
          ko: '주세요',
          roman: 'juseyo',
          kana: 'ジュセヨ',
          meaning: { en: 'please', ja: 'ください', zh: '请给我' },
        },
      ],
    });
  });

  it('한 품목 · 포장 → 끝에 "포장해 주세요." (모든 표기·번역·단어)', () => {
    const s = buildOrderSentence([{ item: soboro, qty: 2 }], true)!;
    expect(s.ko).toBe('튀김소보로 두 개 주세요. 포장해 주세요.');
    expect(s.roman).toBe('twigim soboro du gae juseyo. pojanghae juseyo.');
    expect(s.kana).toBe('トィギム ソボロ トゥ ゲ ジュセヨ。 ポジャンヘ ジュセヨ。');
    expect(s.meaning).toEqual({
      en: 'Fried Soboro ×2, please. To go, please.',
      ja: '揚げソボロパン ×2 をください。持ち帰りでお願いします。',
      zh: '请给我炸酥粒面包 ×2。请打包。',
    });
    expect(s.words.map((w) => w.ko)).toEqual(['튀김소보로', '두 개', '주세요', '포장해', '주세요']);
    expect(s.words[3]).toEqual({
      ko: '포장해',
      roman: 'pojanghae',
      kana: 'ポジャンヘ',
      meaning: { en: 'to go', ja: '持ち帰り', zh: '打包' },
    });
  });

  it('매장(false)에는 포장 문구가 어디에도 없다', () => {
    const s = buildOrderSentence([{ item: tofu, qty: 1 }], false)!;
    expect(s.ko).not.toContain('포장');
    expect(s.roman).not.toContain('pojang');
    expect(s.kana).not.toContain('ポジャン');
    expect(s.meaning.en).not.toContain('To go');
    expect(s.words.some((w) => w.ko === '포장해')).toBe(false);
  });
});

describe('buildOrderSentence — 여러 품목', () => {
  const lines = [
    { item: soboro, qty: 2 },
    { item: tofu, qty: 3 },
    { item: rice, qty: 1 },
  ];

  it('단위별 수사(개·인분·공기)를 섞어 쉼표로 잇는다', () => {
    const s = buildOrderSentence(lines, false)!;
    expect(s.ko).toBe('튀김소보로 두 개, 두부두루치기 3인분, 밥 한 공기 주세요.');
    expect(s.roman).toBe('twigim soboro du gae, dubu duruchigi saminbun, bap han gonggi juseyo.');
    expect(s.kana).toBe(
      'トィギム ソボロ トゥ ゲ、トゥブ トゥルチギ サミンブン、パプ ハン コンギ ジュセヨ。',
    );
    expect(s.meaning).toEqual({
      en: 'Fried Soboro ×2, Spicy Braised Tofu ×3, Rice ×1, please.',
      ja: '揚げソボロパン ×2、豆腐トゥルチギ ×3、ご飯 ×1 をください。',
      zh: '请给我炸酥粒面包 ×2、辣炒豆腐 ×3、米饭 ×1。',
    });
  });

  it('수량 칩 뜻은 단위별(개 × n · 인분 servings · 공기 bowl), 문장 번역은 ×n 유지', () => {
    const s = buildOrderSentence(lines, false)!;
    const qty = s.words.filter((_, i) => i % 2 === 1 && i < 6);
    expect(qty.map((w) => w.ko)).toEqual(['두 개', '3인분', '한 공기']);
    expect(qty.map((w) => w.meaning)).toEqual([
      { en: '× 2', ja: '× 2', zh: '× 2' },
      { en: '3 servings', ja: '3人前', zh: '3人份' },
      { en: '1 bowl', ja: '1杯', zh: '1碗' },
    ]);
    expect(s.meaning.en).toContain('Spicy Braised Tofu ×3');
  });

  it('단어 칩은 문장 순서 그대로이고, 이어 붙이면 문장부호 뺀 문장과 같다', () => {
    for (const takeout of [false, true]) {
      const s = buildOrderSentence(lines, takeout)!;
      expect(s.words.map((w) => w.ko).join(' ')).toBe(strip(s.ko));
      expect(s.words.map((w) => w.roman).join(' ')).toBe(strip(s.roman));
      expect(s.words.map((w) => w.kana).join(' ')).toBe(strip(s.kana));
    }
  });

  it('같은 수량 구절이 두 번 나와도 칩을 합치지 않는다', () => {
    const s = buildOrderSentence(
      [
        { item: soboro, qty: 2 },
        { item: chive, qty: 2 },
      ],
      false,
    )!;
    expect(s.ko).toBe('튀김소보로 두 개, 판타롱부추빵 두 개 주세요.');
    expect(s.words.map((w) => w.ko)).toEqual([
      '튀김소보로',
      '두 개',
      '판타롱부추빵',
      '두 개',
      '주세요',
    ]);
  });

  it('입력 순서를 유지한다', () => {
    const s = buildOrderSentence(
      [
        { item: rice, qty: 9 },
        { item: soboro, qty: 1 },
      ],
      false,
    )!;
    expect(s.ko).toBe('밥 아홉 공기, 튀김소보로 한 개 주세요.');
  });
});

describe('buildOrderSentence — 0개 제외·빈 주문', () => {
  it('줄이 없으면 null', () => {
    expect(buildOrderSentence([], false)).toBeNull();
    expect(buildOrderSentence([], true)).toBeNull();
  });

  it('모두 0개면 null', () => {
    expect(
      buildOrderSentence(
        [
          { item: soboro, qty: 0 },
          { item: tofu, qty: 0 },
        ],
        true,
      ),
    ).toBeNull();
  });

  it('0개 항목은 문장·번역·단어에서 빠진다', () => {
    const s = buildOrderSentence(
      [
        { item: soboro, qty: 0 },
        { item: tofu, qty: 2 },
      ],
      false,
    )!;
    expect(s.ko).toBe('두부두루치기 2인분 주세요.');
    expect(s.roman).toBe('dubu duruchigi i-inbun juseyo.');
    expect(s.meaning.en).toBe('Spicy Braised Tofu ×2, please.');
    expect(s.words.some((w) => w.ko === soboro.ko)).toBe(false);
  });
});

describe('buildOrderSentence — 수량 1~9 제한', () => {
  it.each([1, 9])('경계값 %i 허용', (qty) => {
    expect(buildOrderSentence([{ item: soboro, qty }], false)).not.toBeNull();
  });

  it.each([10, -1, 1.5, NaN, Infinity])('수량 %s → RangeError', (qty) => {
    expect(() => buildOrderSentence([{ item: soboro, qty }], false)).toThrow(RangeError);
    // 다른 정상 항목이 있어도 거부
    expect(() =>
      buildOrderSentence(
        [
          { item: tofu, qty: 1 },
          { item: soboro, qty },
        ],
        false,
      ),
    ).toThrow(RangeError);
  });

  it('같은 메뉴 id가 두 번이면 RangeError', () => {
    expect(() =>
      buildOrderSentence(
        [
          { item: soboro, qty: 1 },
          { item: soboro, qty: 2 },
        ],
        false,
      ),
    ).toThrow(RangeError);
  });
});

describe('buildOrderSentence — 결과 독립성', () => {
  it('결과를 고쳐도 다음 결과·입력 메뉴에 영향이 없다', () => {
    const order = [
      { item: soboro, qty: 1 },
      { item: tofu, qty: 2 },
      { item: rice, qty: 2 },
    ];
    const a = buildOrderSentence(order, true)!;
    a.words.forEach((w) => (w.meaning.en = 'X'));
    const b = buildOrderSentence(order, true)!;
    expect(b.words.map((w) => w.meaning.en)).toEqual([
      'Fried Soboro',
      '× 1',
      'Spicy Braised Tofu',
      '2 servings',
      'Rice',
      '2 bowls',
      'please',
      'to go',
      'please',
    ]);
    expect(soboro.name.en).toBe('Fried Soboro');
  });
});

describe('toOrderLines', () => {
  const list = [soboro, chive, tofu];

  it('메뉴 순서대로 1개 이상만, 메뉴에 없는 id는 무시', () => {
    const lines = toOrderLines(list, { dt: 2, tw: 1, bu: 0, ghost: 3 });
    expect(lines).toEqual([
      { item: soboro, qty: 1 },
      { item: tofu, qty: 2 },
    ]);
  });

  it('빈 장바구니 → 빈 배열 → 문장 null', () => {
    expect(toOrderLines(list, {})).toEqual([]);
    expect(buildOrderSentence(toOrderLines(list, {}), false)).toBeNull();
  });
});
