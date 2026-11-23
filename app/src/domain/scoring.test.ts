import { decompose, levenshtein, normalize, scoreSpeech, similarity } from './scoring';

// numerals.ts(T1.3) 시그니처에만 의존하는 단위 테스트는 검수표(task.md T1.3) 값을 fixture로 씁니다.
// 맨 아래 통합 테스트는 numeralsMode.real = true로 실제 모듈을 그대로 통과시킵니다.
const numeralsMode = vi.hoisted(() => ({ real: false }));
vi.mock('./numerals', async (importActual) => {
  const actual = await importActual<typeof import('./numerals')>();
  const native = ['한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
  const sino = ['일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  return {
    ...actual,
    toNative: (n: number) => (numeralsMode.real ? actual.toNative(n) : native[n - 1]),
    toSino: (n: number) => (numeralsMode.real ? actual.toSino(n) : sino[n - 1]),
  };
});

describe('normalize', () => {
  it('공백·문장부호 제거, 소문자화', () => {
    expect(normalize(' 튀김소보로  하나, 주세요! ')).toBe('튀김소보로하나주세요');
    expect(normalize('OK? 좋아요~')).toBe('ok좋아요');
  });

  it('숫자 → 수사: 개·공기·명은 고유어, 인분은 한자어', () => {
    expect(normalize('2개')).toBe('두개');
    expect(normalize('3 공기')).toBe('세공기');
    expect(normalize('4명')).toBe('네명');
    expect(normalize('2인분')).toBe('이인분');
    expect(normalize('6 인분')).toBe('육인분');
  });

  it('숫자와 단위가 다른 토큰이어도 변환', () => {
    expect(normalize('칼국수 2 개 주세요')).toBe('칼국수두개주세요');
  });

  it('범위(1~9) 밖·단위 없는 숫자는 그대로', () => {
    expect(normalize('10개')).toBe('10개');
    expect(normalize('2번 출구')).toBe('2번출구');
  });
});

describe('decompose / levenshtein / similarity', () => {
  it('음절을 초·중·종성으로 분해', () => {
    expect(decompose('각')).toEqual(['ᄀ', 'ᅡ', 'ᆨ']);
    expect(decompose('가')).toHaveLength(2);
    expect(decompose('a가')).toHaveLength(3);
  });

  it('레벤슈타인 거리', () => {
    expect(levenshtein([...'kitten'], [...'sitting'])).toBe(3);
    expect(levenshtein([], [...'abc'])).toBe(3);
    expect(levenshtein([...'abc'], [...'abc'])).toBe(0);
  });

  it('공식 round(100 × (1 − 거리/max)) 및 하한 0', () => {
    // '개'(ㄱㅐ) vs '게'(ㄱㅔ): 거리 1 / 2 → 50
    expect(similarity('개', '게')).toBe(50);
    expect(similarity('가', 'zzzzzz')).toBe(0);
    expect(similarity('', '')).toBe(100);
  });
});

describe('scoreSpeech', () => {
  it('완전 일치 → 100, 약한 단어 없음', () => {
    const r = scoreSpeech('튀김소보로 두 개 주세요.', '튀김소보로 두 개 주세요');
    expect(r).toEqual({
      status: 'scored',
      score: 100,
      weakestIndex: null,
      words: [
        { ko: '튀김소보로', heard: '튀김소보로', matched: true, score: 100 },
        { ko: '두', heard: '두', matched: true, score: 100 },
        { ko: '개', heard: '개', matched: true, score: 100 },
        { ko: '주세요', heard: '주세요', matched: true, score: 100 },
      ],
    });
  });

  it("숫자 표기 차이: '두 개' ↔ '2개' → 100", () => {
    const r = scoreSpeech('두 개', '2개');
    expect(r.status === 'scored' && r.score).toBe(100);
    const r2 = scoreSpeech('칼국수 2인분 주세요.', '칼국수 이인분 주세요');
    expect(r2.status === 'scored' && r2.score).toBe(100);
  });

  it('띄어쓰기 차이 → 100, 단어별로 다시 나눠 정렬', () => {
    const r = scoreSpeech('튀김소보로 두 개 주세요.', '튀김소보로두개주세요');
    if (r.status !== 'scored') throw new Error('scored 기대');
    expect(r.score).toBe(100);
    expect(r.words.map((w) => w.heard)).toEqual(['튀김소보로', '두', '개', '주세요']);
    expect(r.weakestIndex).toBeNull();
  });

  it('한 글자 틀림 → 감점, 해당 단어가 약한 단어', () => {
    const r = scoreSpeech('튀김소보로 두 개 주세요.', '튀김소보로 두 게 주세요');
    if (r.status !== 'scored') throw new Error('scored 기대');
    // 목표 자모 22개 중 1개 치환 → round(100 × 21/22) = 95
    expect(r.score).toBe(95);
    expect(r.words[2]).toEqual({ ko: '개', heard: '게', matched: false, score: 50 });
    expect(r.weakestIndex).toBe(2);
    expect(r.words.filter((w) => !w.matched)).toHaveLength(1);
  });

  it('가장 낮은 점수의 단어를 약한 단어로 (동점이면 앞 단어)', () => {
    const r = scoreSpeech('물 좀 주세요', '불 좀 주새요');
    if (r.status !== 'scored') throw new Error('scored 기대');
    // 물→불: 1/3 틀림(67), 주세요→주새요: 1/6 틀림(83)
    expect(r.words.map((w) => w.score)).toEqual([67, 100, 83]);
    expect(r.weakestIndex).toBe(0);
  });

  it('빠진 단어는 heard null, score 0', () => {
    const r = scoreSpeech('칼국수 두 개 주세요', '칼국수 주세요');
    if (r.status !== 'scored') throw new Error('scored 기대');
    expect(r.words[1]).toEqual({ ko: '두', heard: null, matched: false, score: 0 });
    expect(r.words[2]).toEqual({ ko: '개', heard: null, matched: false, score: 0 });
    expect(r.weakestIndex).toBe(1);
    expect(r.score).toBeLessThan(100);
  });

  it('덧붙인 말은 인접 단어에 붙어 감점', () => {
    const r = scoreSpeech('주세요', '음 주세요');
    if (r.status !== 'scored') throw new Error('scored 기대');
    expect(r.words[0].heard).toBe('음주세요');
    expect(r.words[0].matched).toBe(false);
    expect(r.score).toBeLessThan(100);
  });

  it('점수 하한 0', () => {
    const r = scoreSpeech('네', 'hello world testing');
    expect(r.status === 'scored' && r.score).toBe(0);
  });

  it("빈 입력 → status 'empty' (0점 아님)", () => {
    expect(scoreSpeech('주세요', '')).toEqual({ status: 'empty' });
    expect(scoreSpeech('주세요', '   ')).toEqual({ status: 'empty' });
    expect(scoreSpeech('주세요', '.?!')).toEqual({ status: 'empty' });
  });
});

describe('R1 회귀', () => {
  it('SC-R1-01: 숫자와 단위 사이 문장부호가 있어도 수사 변환', () => {
    for (const heard of ['2, 개', '2 , 개', '2-개', '2 (개)']) {
      expect(normalize(heard)).toBe('두개');
      const r = scoreSpeech('두 개', heard);
      expect(r.status === 'scored' && r.score).toBe(100);
    }
  });

  it('SC-R1-02: NFD 입력도 NFC와 같게 채점 (겹받침 포함)', () => {
    const target = '닭갈비 두 개 값 주세요';
    const nfd = target.normalize('NFD');
    for (const [t, h] of [
      [target, nfd],
      [nfd, target],
      [nfd, nfd],
    ]) {
      const r = scoreSpeech(t, h);
      if (r.status !== 'scored') throw new Error('scored 기대');
      expect(r.score).toBe(100);
      expect(r.words.every((w) => w.matched)).toBe(true);
      expect(r.words.map((w) => w.heard)).toEqual(['닭갈비', '두', '개', '값', '주세요']);
      expect(r.weakestIndex).toBeNull();
    }
  });

  it('SC-R1-03: 반올림 점수가 100이어도 문자열이 다르면 불일치', () => {
    const r = scoreSpeech('가'.repeat(101), '가'.repeat(100) + '나');
    if (r.status !== 'scored') throw new Error('scored 기대');
    expect(r.words[0].score).toBe(100);
    expect(r.words[0].matched).toBe(false);
    expect(r.weakestIndex).toBe(0);
  });
});

describe('통합: 실제 numerals.ts (T1.3)', () => {
  beforeAll(() => {
    numeralsMode.real = true;
  });
  afterAll(() => {
    numeralsMode.real = false;
  });

  it('검수표 전 범위(1~9 × 개·공기·인분)를 실제 모듈로 변환·채점', () => {
    const native = ['한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
    const sino = ['일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    for (let n = 1; n <= 9; n++) {
      expect(normalize(`${n}개`)).toBe(`${native[n - 1]}개`);
      expect(normalize(`${n} 공기`)).toBe(`${native[n - 1]}공기`);
      expect(normalize(`${n}인분`)).toBe(`${sino[n - 1]}인분`);
    }
  });

  it("'두 개' ↔ '2개', '2인분' ↔ '이 인분' → 100", () => {
    const r = scoreSpeech('튀김소보로 두 개, 두루치기 2인분 주세요.', '튀김소보로 2개 두루치기 이 인분 주세요');
    if (r.status !== 'scored') throw new Error('scored 기대');
    expect(r.score).toBe(100);
    expect(r.weakestIndex).toBeNull();
  });
});
