import type { Counter } from '../types';
import { isValidQty, quantityMeaning, quantityPhrase, toNative, toSino } from './numerals';

type Cell = [ko: string, roman: string, kana: string];

/** task.md T1.3 수사 검수표 (27칸) — 표 그대로 옮김 */
const TABLE: Record<number, Record<Counter, Cell>> = {
  1: {
    개: ['한 개', 'han gae', 'ハン ゲ'],
    공기: ['한 공기', 'han gonggi', 'ハン コンギ'],
    인분: ['1인분', 'irinbun', 'イリンブン'],
  },
  2: {
    개: ['두 개', 'du gae', 'トゥ ゲ'],
    공기: ['두 공기', 'du gonggi', 'トゥ コンギ'],
    인분: ['2인분', 'i-inbun', 'イインブン'],
  },
  3: {
    개: ['세 개', 'se gae', 'セ ゲ'],
    공기: ['세 공기', 'se gonggi', 'セ コンギ'],
    인분: ['3인분', 'saminbun', 'サミンブン'],
  },
  4: {
    개: ['네 개', 'ne gae', 'ネ ゲ'],
    공기: ['네 공기', 'ne gonggi', 'ネ コンギ'],
    인분: ['4인분', 'sa-inbun', 'サインブン'],
  },
  5: {
    개: ['다섯 개', 'daseot gae', 'タソッ ゲ'],
    공기: ['다섯 공기', 'daseot gonggi', 'タソッ コンギ'],
    인분: ['5인분', 'o-inbun', 'オインブン'],
  },
  6: {
    개: ['여섯 개', 'yeoseot gae', 'ヨソッ ゲ'],
    공기: ['여섯 공기', 'yeoseot gonggi', 'ヨソッ コンギ'],
    인분: ['6인분', 'yuginbun', 'ユギンブン'],
  },
  7: {
    개: ['일곱 개', 'ilgop gae', 'イルゴプ ゲ'],
    공기: ['일곱 공기', 'ilgop gonggi', 'イルゴプ コンギ'],
    인분: ['7인분', 'chirinbun', 'チリンブン'],
  },
  8: {
    개: ['여덟 개', 'yeodeol gae', 'ヨドル ゲ'],
    공기: ['여덟 공기', 'yeodeol gonggi', 'ヨドル コンギ'],
    인분: ['8인분', 'parinbun', 'パリンブン'],
  },
  9: {
    개: ['아홉 개', 'ahop gae', 'アホプ ゲ'],
    공기: ['아홉 공기', 'ahop gonggi', 'アホプ コンギ'],
    인분: ['9인분', 'gu-inbun', 'クインブン'],
  },
};

const CELLS = Object.entries(TABLE).flatMap(([n, row]) =>
  (Object.entries(row) as [Counter, Cell][]).map(([counter, cell]) => ({
    n: Number(n),
    counter,
    cell,
  })),
);

describe('수사 검수표', () => {
  it('27칸', () => {
    expect(CELLS).toHaveLength(27);
  });

  it.each(CELLS)('$n $counter', ({ n, counter, cell: [ko, roman, kana] }) => {
    expect(quantityPhrase(n, counter)).toEqual({ ko, roman, kana });
  });
});

describe('toNative / toSino', () => {
  it('고유어 수사 1~9', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(toNative)).toEqual([
      '한',
      '두',
      '세',
      '네',
      '다섯',
      '여섯',
      '일곱',
      '여덟',
      '아홉',
    ]);
  });

  it('한자어 수사 1~9', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(toSino)).toEqual([
      '일',
      '이',
      '삼',
      '사',
      '오',
      '육',
      '칠',
      '팔',
      '구',
    ]);
  });

  it.each([0, 10, -1, 1.5, NaN, Infinity])('범위 밖 %s → RangeError', (n) => {
    expect(isValidQty(n)).toBe(false);
    expect(() => toNative(n)).toThrow(RangeError);
    expect(() => toSino(n)).toThrow(RangeError);
    expect(() => quantityPhrase(n, '개')).toThrow(RangeError);
    expect(() => quantityPhrase(n, '인분')).toThrow(RangeError);
    for (const c of ['개', '인분', '공기'] as const) {
      expect(() => quantityMeaning(n, c)).toThrow(RangeError);
    }
  });
});

describe('quantityMeaning (수량 칩 뜻, R1-01)', () => {
  it.each([
    [1, '인분', { en: '1 serving', ja: '1人前', zh: '1人份' }],
    [2, '인분', { en: '2 servings', ja: '2人前', zh: '2人份' }],
    [9, '인분', { en: '9 servings', ja: '9人前', zh: '9人份' }],
    [1, '공기', { en: '1 bowl', ja: '1杯', zh: '1碗' }],
    [2, '공기', { en: '2 bowls', ja: '2杯', zh: '2碗' }],
    [9, '공기', { en: '9 bowls', ja: '9杯', zh: '9碗' }],
    [1, '개', { en: '× 1', ja: '× 1', zh: '× 1' }],
    [2, '개', { en: '× 2', ja: '× 2', zh: '× 2' }],
  ] as const)('%i %s', (n, counter, expected) => {
    expect(quantityMeaning(n, counter)).toEqual(expected);
  });

  it('호출마다 새 객체', () => {
    expect(quantityMeaning(2, '인분')).not.toBe(quantityMeaning(2, '인분'));
  });
});
