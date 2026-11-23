import {
  MAX_EVENTS,
  SESSION_GAP_MS,
  appendEvent,
  countByType,
  extraVisitRate,
  SCREEN_KEYS,
  isAppEvent,
  isScreenKey,
  isValidId,
  nextPlaceDistribution,
  splitSessions,
  toAppEvent,
  topPhrases,
  type AppEvent,
  type ScreenKey,
} from './events';
import downtown from '../data/downtown.json';
import { places } from '../data';

const MIN = 60 * 1000;
const pv = (placeId: string, t: number): AppEvent => ({ type: 'place_view', placeId, t });
const sv = (screen: ScreenKey, t: number): AppEvent => ({ type: 'screen_view', screen, t });

describe('appendEvent', () => {
  it('상한 500건을 넘으면 오래된 것부터 버린다', () => {
    let list: AppEvent[] = [];
    for (let i = 0; i < MAX_EVENTS + 20; i++) list = appendEvent(list, sv('home', i));
    expect(list).toHaveLength(MAX_EVENTS);
    expect(list[0].t).toBe(20);
    expect(list[list.length - 1].t).toBe(MAX_EVENTS + 19);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const orig: AppEvent[] = [sv('home', 1)];
    appendEvent(orig, sv('course', 2));
    expect(orig).toHaveLength(1);
  });
});

describe('splitSessions', () => {
  it('30분 무활동이면 새 세션, 그 미만이면 같은 세션', () => {
    const s = splitSessions([
      sv('home', 0),
      sv('course', SESSION_GAP_MS - 1),
      sv('order', 2 * SESSION_GAP_MS - 1),
    ]);
    expect(s.map((x) => x.length)).toEqual([2, 1]);
  });

  it('시각순으로 정렬해서 나눈다', () => {
    const s = splitSessions([sv('course', 40 * MIN), sv('home', 0)]);
    expect(s).toHaveLength(2);
    expect(s[0][0].t).toBe(0);
  });

  it('빈 입력 → 세션 없음', () => {
    expect(splitSessions([])).toEqual([]);
  });
});

describe('extraVisitRate (추가 방문 비율)', () => {
  it('분모 = 성심당 열람 세션, 분자 = 그 뒤 같은 세션에 다른 정류장 열람', () => {
    const day = 24 * 60 * MIN;
    const events: AppEvent[] = [
      // 세션 1: 성심당 → 광천식당 (분자 O)
      pv('ssd', 0),
      pv('gwc', 10 * MIN),
      // 세션 2: 성심당만 (분자 X)
      pv('ssd', day),
      sv('home', day + 5 * MIN),
      // 세션 3: 광천식당 → 성심당 (다른 정류장이 '이전'이라 분자 X)
      pv('gwc', 2 * day),
      pv('ssd', 2 * day + 5 * MIN),
      // 세션 4: 성심당 없음 (분모 제외)
      pv('gwc', 3 * day),
      // 세션 5: 성심당 → 성심당 → 다른 곳 (29분 간격이라 같은 세션, 분자 O)
      pv('ssd', 4 * day),
      pv('ssd', 4 * day + 29 * MIN),
      pv('museum', 4 * day + 58 * MIN),
    ];
    expect(extraVisitRate(events, 'ssd')).toEqual({ numerator: 2, denominator: 4, rate: 0.5 });
  });

  it('30분 무활동 뒤의 다른 정류장 열람은 세지 않는다', () => {
    const r = extraVisitRate([pv('ssd', 0), pv('gwc', 30 * MIN)], 'ssd');
    expect(r).toEqual({ numerator: 0, denominator: 1, rate: 0 });
  });

  it('성심당 열람이 없으면 rate = null', () => {
    expect(extraVisitRate([pv('gwc', 0)], 'ssd')).toEqual({
      numerator: 0,
      denominator: 0,
      rate: null,
    });
  });
});

describe('nextPlaceDistribution', () => {
  it('세션마다 기준 장소 이후 처음 연 다른 장소를 센다', () => {
    const h = 60 * MIN;
    const events = [
      pv('ssd', 0),
      pv('gwc', MIN),
      pv('museum', 2 * MIN),
      pv('ssd', 2 * h),
      pv('gwc', 2 * h + MIN),
      pv('ssd', 4 * h),
      pv('museum', 4 * h + MIN),
      pv('ssd', 6 * h),
    ];
    expect(nextPlaceDistribution(events, 'ssd')).toEqual({ gwc: 2, museum: 1 });
  });
});

describe('topPhrases / countByType', () => {
  const events: AppEvent[] = [
    { type: 'phrase_play', src: 'phrase', phraseId: 'p2', t: 1 },
    { type: 'phrase_play', src: 'phrase', phraseId: 'p1', t: 2 },
    { type: 'phrase_play', src: 'phrase', phraseId: 'p2', t: 3 },
    { type: 'phrase_play', src: 'order', t: 4 },
    { type: 'practice_done', src: 'order', score: 90, t: 5 },
    { type: 'report_sent', kind: 'price', t: 6 },
  ];

  it('문장 재생 횟수 내림차순, 주문 문장(phraseId 없음)은 제외', () => {
    expect(topPhrases(events)).toEqual([
      { phraseId: 'p2', count: 2 },
      { phraseId: 'p1', count: 1 },
    ]);
    expect(topPhrases(events, 1)).toHaveLength(1);
  });

  it('종류별 건수', () => {
    expect(countByType(events)).toEqual({
      screen_view: 0,
      place_view: 0,
      phrase_play: 4,
      practice_done: 1,
      staff_shown: 0,
      report_sent: 1,
    });
  });
});

describe('isAppEvent', () => {
  it('정상 이벤트는 통과, 손상된 값은 거른다', () => {
    expect(isAppEvent(pv('ssd', 1))).toBe(true);
    expect(isAppEvent({ type: 'report_sent', kind: 'closed', t: 1 })).toBe(true);
    expect(isAppEvent({ type: 'place_view', t: 1 })).toBe(false);
    expect(isAppEvent({ type: 'unknown', t: 1 })).toBe(false);
    expect(isAppEvent({ type: 'screen_view', screen: 'x', t: 'now' })).toBe(false);
    expect(isAppEvent({ type: 'report_sent', kind: 'spam', t: 1 })).toBe(false);
    expect(isAppEvent(null)).toBe(false);
  });
});

describe('toAppEvent (R1 M-01·M-04)', () => {
  it('허용 필드만으로 새 객체를 만든다', () => {
    const raw = {
      type: 'staff_shown',
      src: 'order',
      placeId: 'ssd',
      transcript: 'x',
      extra: 1,
      t: 9,
    };
    const e = toAppEvent(raw);
    expect(e).toEqual({ type: 'staff_shown', src: 'order', placeId: 'ssd', t: 9 });
    expect(e).not.toBe(raw);
    expect(toAppEvent({ type: 'report_sent', kind: 'price', note: '원문', t: 1 })).toEqual({
      type: 'report_sent',
      kind: 'price',
      t: 1,
    });
  });

  it('선택 필드가 있는데 형식이 틀리면 이벤트 전체를 버린다', () => {
    expect(toAppEvent({ type: 'phrase_play', src: 'phrase', phraseId: 7, t: 1 })).toBeNull();
    expect(
      toAppEvent({ type: 'phrase_play', src: 'phrase', phraseId: { raw: 1 }, t: 1 }),
    ).toBeNull();
    expect(toAppEvent({ type: 'practice_done', src: 'order', score: -1, t: 1 })).toBeNull();
    expect(toAppEvent({ type: 'practice_done', src: 'order', score: 101, t: 1 })).toBeNull();
    expect(toAppEvent({ type: 'practice_done', src: 'order', score: Infinity, t: 1 })).toBeNull();
    expect(toAppEvent({ type: 'report_sent', kind: 'menu', placeId: '성심당', t: 1 })).toBeNull();
    expect(toAppEvent({ type: 'place_view', placeId: 'ssd', t: Number.NaN })).toBeNull();
    expect(toAppEvent([])).toBeNull();
  });

  it('경계값 score 0·100, 선택 필드 생략은 통과', () => {
    expect(toAppEvent({ type: 'practice_done', src: 'order', score: 0, t: 1 })).not.toBeNull();
    expect(toAppEvent({ type: 'practice_done', src: 'order', score: 100, t: 1 })).not.toBeNull();
    expect(toAppEvent({ type: 'practice_done', src: 'phrase', t: 1 })).toEqual({
      type: 'practice_done',
      src: 'phrase',
      t: 1,
    });
  });

  it('ID 형식: 소문자·숫자·하이픈·밑줄, 64자 이하', () => {
    expect(isValidId('gwc-1')).toBe(true);
    expect(isValidId('order_card')).toBe(true);
    expect(isValidId('a'.repeat(64))).toBe(true);
    expect(isValidId('a'.repeat(65))).toBe(false);
    expect(isValidId('-ssd')).toBe(false);
    expect(isValidId('Ssd')).toBe(false);
    expect(isValidId('이거 주세요')).toBe(false);
    expect(isValidId('a b')).toBe(false);
    expect(isValidId('')).toBe(false);
  });
});

describe('R2-L01: 화면 키·콘텐츠 ID 계약', () => {
  /** downtown.json의 모든 `id`·`*Id` 값 (중첩 포함) */
  function collectIds(v: unknown, out: string[] = []): string[] {
    if (Array.isArray(v)) v.forEach((x) => collectIds(x, out));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if ((k === 'id' || k.endsWith('Id')) && typeof x === 'string') out.push(x);
        else collectIds(x, out);
      }
    }
    return out;
  }

  it('downtown.json의 실제 ID 27개가 모두 ID 형식을 통과', () => {
    const ids = collectIds(downtown);
    expect(ids).toHaveLength(27);
    expect(ids.filter((id) => !isValidId(id))).toEqual([]);
  });

  it('모든 장소 place_view, 모든 문장 phrase_play가 기록 가능', () => {
    expect(places.length).toBeGreaterThan(0);
    for (const p of places) {
      expect(toAppEvent({ type: 'place_view', placeId: p.id, t: 1 })).not.toBeNull();
      for (const ph of p.phrases) {
        expect(
          toAppEvent({ type: 'phrase_play', src: 'phrase', placeId: p.id, phraseId: ph.id, t: 1 }),
        ).not.toBeNull();
      }
    }
  });

  it('SCREEN_KEYS 13개(S00~S13) 전부 screen_view로 통과', () => {
    expect(SCREEN_KEYS).toHaveLength(13);
    for (const screen of SCREEN_KEYS) {
      expect(toAppEvent({ type: 'screen_view', screen, t: 1 })).toEqual({
        type: 'screen_view',
        screen,
        t: 1,
      });
      expect(isScreenKey(screen)).toBe(true);
    }
  });

  it('라우트 경로·임의 문자열 screen, 대문자 phraseId → null', () => {
    expect(toAppEvent({ type: 'screen_view', screen: '/order', t: 1 })).toBeNull();
    expect(toAppEvent({ type: 'screen_view', screen: '/', t: 1 })).toBeNull();
    expect(toAppEvent({ type: 'screen_view', screen: 'hello', t: 1 })).toBeNull();
    expect(toAppEvent({ type: 'phrase_play', src: 'phrase', phraseId: 'SSD-1', t: 1 })).toBeNull();
  });
});
