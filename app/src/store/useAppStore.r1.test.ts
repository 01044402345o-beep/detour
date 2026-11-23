/** T1.6 R1 판정(reviews/T1.6_r1_verdict.md) 회귀 테스트: M-01·M-02·M-03·M-04·M-06 */
import { countByType, extraVisitRate, topPhrases } from '../domain/events';
import { createMemoryStorage, createSafeStorage } from './safeStorage';
import { STORAGE_KEY, STORAGE_VERSION, createAppStore, type PlaceRef } from './useAppStore';

const SSD: PlaceRef = { id: 'ssd', takeout: true };
const GWC: PlaceRef = { id: 'gwc', takeout: false };
const SECRET = 'PRIVATE_RECOGNITION_TEXT 튀김소보로 두 개 주세요';

function setup(now = () => 1000) {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage, now });
  return { storage, store, s: () => store.getState() };
}

function restore(state: object) {
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }));
  return { storage, store: createAppStore({ storage }) };
}

describe('M-01: 저장 경계에서 원문·추가 필드 제거', () => {
  it('추가 필드가 붙은 변수로 logEvent → 저장 JSON에 원문 없음', () => {
    const { storage, s } = setup(() => 7);
    const result = {
      type: 'practice_done' as const,
      src: 'phrase' as const,
      score: 88,
      transcript: SECRET,
    };
    s().logEvent(result); // 변수 전달은 초과 속성 검사를 받지 않음
    expect(s().events).toEqual([{ type: 'practice_done', src: 'phrase', score: 88, t: 7 }]);
    const json = storage.getItem(STORAGE_KEY) as string;
    expect(json).not.toContain('transcript');
    expect(json).not.toContain('PRIVATE_RECOGNITION_TEXT');
  });

  it('한글 문장·대문자 등 ID 형식이 아닌 screen/phraseId/placeId, 범위 밖 score → 기록 안 함', () => {
    const { s } = setup();
    s().logEvent({ type: 'screen_view', screen: SECRET as never });
    s().logEvent({ type: 'phrase_play', src: 'phrase', phraseId: '이거 하나 주세요' });
    s().logEvent({ type: 'place_view', placeId: 'SSD' });
    s().logEvent({ type: 'practice_done', src: 'order', score: 150 });
    s().logEvent({ type: 'practice_done', src: 'order', score: Number.NaN });
    expect(s().events).toEqual([]);
    s().logEvent({ type: 'phrase_play', src: 'phrase', phraseId: 'ssd-1', placeId: 'ssd' });
    expect(s().events).toHaveLength(1);
  });

  it('addReport: 형식이 틀린 placeId는 생략', () => {
    const { s } = setup(() => 3);
    s().addReport('menu', '성심당 메뉴가 달라요');
    expect(s().reports).toEqual([{ kind: 'menu', t: 3 }]);
    expect(s().events).toEqual([{ type: 'report_sent', kind: 'menu', t: 3 }]);
  });

  it('추가 필드가 있는 저장값 복원 → events·reports 필드 제거, 다시 저장해도 원문 없음', () => {
    const { storage, store } = restore({
      events: [{ type: 'practice_done', src: 'phrase', score: 50, transcript: SECRET, t: 1 }],
      reports: [{ kind: 'other', t: 2, text: SECRET, placeId: 'ssd' }],
    });
    const st = store.getState();
    expect(st.events).toEqual([{ type: 'practice_done', src: 'phrase', score: 50, t: 1 }]);
    expect(st.reports).toEqual([{ kind: 'other', placeId: 'ssd', t: 2 }]);
    st.setLang('en');
    expect(storage.getItem(STORAGE_KEY)).not.toContain('PRIVATE_RECOGNITION_TEXT');
  });
});

describe('M-04: 선택 필드가 손상된 저장값 복원 후 지표 계산', () => {
  it('손상 이벤트는 버리고 topPhrases·extraVisitRate·countByType이 예외 없이 계산', () => {
    const { store } = restore({
      events: [
        { type: 'place_view', placeId: 'ssd', t: 1 },
        { type: 'phrase_play', src: 'phrase', phraseId: 'ssd-1', t: 2 },
        { type: 'phrase_play', src: 'phrase', phraseId: { raw: 'text' }, t: 3 },
        { type: 'phrase_play', src: 'phrase', phraseId: 7, t: 4 },
        { type: 'place_view', placeId: 5, t: 5 },
        { type: 'practice_done', src: 'order', score: 150, t: 6 },
        { type: 'practice_done', src: 'order', score: null, t: 7 },
        { type: 'staff_shown', src: 'order', placeId: ['x'], t: 8 },
      ],
    });
    const { events } = store.getState();
    expect(events).toHaveLength(2);
    expect(topPhrases(events)).toEqual([{ phraseId: 'ssd-1', count: 1 }]);
    expect(extraVisitRate(events, 'ssd')).toEqual({ numerator: 0, denominator: 1, rate: 0 });
    expect(countByType(events).phrase_play).toBe(1);
  });
});

describe('M-06: 손상 복원 시 단일 활성 주문 복구', () => {
  it('currentPlaceId 없는 한 장소 주문 → 현재 장소 복구 → 전환 확인 → 취소 유지 / 확인 비움', () => {
    const { store } = restore({ cart: { ssd: { m1: 2 } } });
    const s = () => store.getState();
    expect(s().currentPlaceId).toBe('ssd');
    expect(s().switchPlace(GWC)).toEqual({ needsConfirm: true });
    s().cancelSwitchPlace();
    expect(s().cart).toEqual({ ssd: { m1: 2 } });
    s().switchPlace(GWC);
    s().confirmSwitchPlace();
    expect(s().cart).toEqual({});
    expect(s().currentPlaceId).toBe('gwc');
  });

  it('currentPlaceId 없이 두 장소 주문 → 모두 비움', () => {
    const st = restore({
      cart: { ssd: { m1: 1 }, gwc: { m2: 1 } },
      currentPlaceId: null,
    }).store.getState();
    expect(st.cart).toEqual({});
    expect(st.currentPlaceId).toBeNull();
  });

  it('currentPlaceId와 다른 장소의 주문은 제거', () => {
    const st = restore({
      cart: { ssd: { m1: 1 }, gwc: { m2: 3 } },
      currentPlaceId: 'gwc',
    }).store.getState();
    expect(st.cart).toEqual({ gwc: { m2: 3 } });
  });

  it('보조 방어: 현재 장소 밖에 주문이 남아 있어도 전환 시 확인', () => {
    const { store, s } = setup();
    s().switchPlace(SSD);
    store.setState({ cart: { gwc: { m1: 1 } } }); // 불변식이 깨진 상태를 강제
    expect(s().switchPlace({ id: 'mus', takeout: false })).toEqual({ needsConfirm: true });
  });
});

/** 원본 Map을 노출하는 Storage. `ctl.failWrites`가 true면 setItem이 Quota 예외 */
function backing(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  const ctl = { failWrites: false };
  const ls: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (ctl.failWrites) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k) => void map.delete(k),
  };
  return { map, ls, ctl };
}

describe('M-02·M-03: 쓰기 실패 저장소', () => {
  it('M-02: 시작부터 쓰기만 실패해도 기존 언어·북마크·주문을 복원', () => {
    const saved = JSON.stringify({
      version: STORAGE_VERSION,
      state: {
        lang: 'ja',
        saved: { places: ['ssd'], phrases: [] },
        cart: { ssd: { tw: 2 } },
        currentPlaceId: 'ssd',
      },
    });
    const b = backing({ [STORAGE_KEY]: saved });
    b.ctl.failWrites = true;
    const wrapper = createSafeStorage(() => b.ls);
    const store = createAppStore({ storage: wrapper });
    const st = store.getState();
    expect(st.lang).toBe('ja');
    expect(st.saved.places).toEqual(['ssd']);
    expect(st.cart).toEqual({ ssd: { tw: 2 } });
    // 이후 변경은 메모리에서 이어짐
    st.setLang('zh');
    expect(wrapper.mode).toBe('memory');
    expect(JSON.parse(wrapper.getItem(STORAGE_KEY) as string).state.lang).toBe('zh');
  });

  it('M-03: 쓰기 실패 뒤 resetData → 원본에 옛 스냅숏 없음 → 다음 실행에 되살아나지 않음', () => {
    const b = backing();
    const store = createAppStore({ storage: createSafeStorage(() => b.ls) });
    store.getState().switchPlace(SSD);
    store.getState().increment('ssd', 'tw');
    store.getState().logEvent({ type: 'place_view', placeId: 'ssd' });
    expect(b.map.get(STORAGE_KEY)).toContain('place_view');

    b.ctl.failWrites = true;
    store.getState().resetData();
    expect(b.map.has(STORAGE_KEY)).toBe(false);
    expect(store.getState().events).toEqual([]);

    b.ctl.failWrites = false;
    const next = createAppStore({ storage: createSafeStorage(() => b.ls) }).getState();
    expect(next.events).toEqual([]);
    expect(next.cart).toEqual({});
  });

  it('M-03: 쓰기 실패 뒤 clearEvents도 다음 실행에 유지', () => {
    const b = backing();
    const store = createAppStore({ storage: createSafeStorage(() => b.ls) });
    store.getState().logEvent({ type: 'place_view', placeId: 'ssd' });
    b.ctl.failWrites = true;
    store.getState().clearEvents();
    b.ctl.failWrites = false;
    expect(createAppStore({ storage: createSafeStorage(() => b.ls) }).getState().events).toEqual(
      [],
    );
  });

  it('M-03: 실패 후 다시 쓸 수 있게 되면 최신 값이 원본에 저장', () => {
    const b = backing();
    const store = createAppStore({ storage: createSafeStorage(() => b.ls) });
    store.getState().setLang('en');
    b.ctl.failWrites = true;
    store.getState().setLang('ja');
    b.ctl.failWrites = false;
    store.getState().setLang('zh');
    expect(JSON.parse(b.map.get(STORAGE_KEY) as string).state.lang).toBe('zh');
  });
});
