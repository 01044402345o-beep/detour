import { getPlace } from '../data';
import { MAX_EVENTS, extraVisitRate } from '../domain/events';
import { buildOrderSentence, toOrderLines } from '../domain/orderSentence';
import { createMemoryStorage, createSafeStorage } from './safeStorage';
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  cartCount,
  createAppStore,
  effectiveTakeout,
  sanitizePersisted,
  useAppStore,
  type PlaceRef,
} from './useAppStore';

const SSD: PlaceRef = { id: 'ssd', takeout: true };
const GWC: PlaceRef = { id: 'gwc', takeout: false };

function setup(now = () => 1000) {
  const storage = createMemoryStorage();
  const store = createAppStore({ storage, now });
  return { storage, store, s: () => store.getState() };
}

describe('lang', () => {
  it('처음엔 null, setLang으로 저장', () => {
    const { s } = setup();
    expect(s().lang).toBeNull();
    s().setLang('zh');
    expect(s().lang).toBe('zh');
  });
});

describe('장소 전환·주문', () => {
  it('주문이 없으면 확인 없이 전환', () => {
    const { s } = setup();
    expect(s().switchPlace(SSD)).toEqual({ needsConfirm: false });
    expect(s().currentPlaceId).toBe('ssd');
  });

  it('현재 장소에서만 담을 수 있고, 1~9로 제한, 1에서 −면 삭제', () => {
    const { s } = setup();
    expect(s().increment('ssd', 'm1')).toBe(false); // 아직 현재 장소 아님
    s().switchPlace(SSD);
    s().increment('ssd', 'm1');
    s().increment('ssd', 'm1');
    expect(s().cart).toEqual({ ssd: { m1: 2 } });
    s().setQty('ssd', 'm2', 42);
    expect(s().cart.ssd.m2).toBe(9);
    s().increment('ssd', 'm2');
    expect(s().cart.ssd.m2).toBe(9);
    s().setQty('ssd', 'm1', 1);
    s().decrement('ssd', 'm1');
    expect(s().cart.ssd).toEqual({ m2: 9 });
    expect(cartCount(s().cart, 'ssd')).toBe(9);
    expect(s().increment('gwc', 'x')).toBe(false);
  });

  it('다른 장소로 가려는데 주문이 있으면 needsConfirm → 확인 시 비우고 전환', () => {
    const { s } = setup();
    s().switchPlace(SSD);
    s().increment('ssd', 'm1');
    expect(s().switchPlace(GWC)).toEqual({ needsConfirm: true });
    expect(s().currentPlaceId).toBe('ssd');
    expect(s().pendingPlace).toEqual(GWC);
    s().confirmSwitchPlace();
    expect(s().currentPlaceId).toBe('gwc');
    expect(s().cart).toEqual({});
    expect(s().pendingPlace).toBeNull();
  });

  it('취소하면 기존 주문과 장소 유지', () => {
    const { s } = setup();
    s().switchPlace(SSD);
    s().increment('ssd', 'm1');
    s().switchPlace(GWC);
    s().cancelSwitchPlace();
    expect(s().currentPlaceId).toBe('ssd');
    expect(s().cart).toEqual({ ssd: { m1: 1 } });
    expect(s().pendingPlace).toBeNull();
  });

  it('같은 장소로 다시 들어가면 확인 없이 주문 유지', () => {
    const { s } = setup();
    s().switchPlace(SSD);
    s().increment('ssd', 'm1');
    expect(s().switchPlace(SSD)).toEqual({ needsConfirm: false });
    expect(s().cart).toEqual({ ssd: { m1: 1 } });
  });

  it('clearCart로 비우면 다른 장소로 확인 없이 전환', () => {
    const { s } = setup();
    s().switchPlace(SSD);
    s().increment('ssd', 'm1');
    s().clearCart();
    expect(s().switchPlace(GWC)).toEqual({ needsConfirm: false });
  });
});

describe('takeout 강제 (F-05 매장 고정)', () => {
  it('포장 선택 후 takeout:false 장소로 전환하면 false', () => {
    const { s } = setup();
    s().switchPlace(SSD);
    s().setTakeout(SSD, true);
    expect(s().takeout).toBe(true);
    s().switchPlace(GWC);
    expect(s().takeout).toBe(false);
  });

  it('확인 후 전환할 때도 false', () => {
    const { s } = setup();
    s().switchPlace(SSD);
    s().setTakeout(SSD, true);
    s().increment('ssd', 'm1');
    s().switchPlace(GWC);
    s().confirmSwitchPlace();
    expect(s().takeout).toBe(false);
  });

  it('takeout:false 장소에서는 setTakeout(true)도 false', () => {
    const { s } = setup();
    s().switchPlace(GWC);
    s().setTakeout(GWC, true);
    expect(s().takeout).toBe(false);
  });

  it('R1 A-1: 포장 가능한 장소 사이에서도 전환하면 매장(false)으로 초기화', () => {
    const { s } = setup();
    const A: PlaceRef = { id: 'a', takeout: true };
    s().switchPlace(A);
    s().setTakeout(A, true);
    s().switchPlace(SSD);
    expect(s().takeout).toBe(false);
  });

  it('R1 M-05: 현재 장소가 아닌 장소로 setTakeout → 불변·false', () => {
    const { s } = setup();
    s().switchPlace(GWC);
    expect(s().setTakeout(SSD, true)).toBe(false);
    expect(s().takeout).toBe(false);
    expect(s().setTakeout(GWC, false)).toBe(true);
  });

  it('R1 M-05: 확인 대기 중 대상 장소로 setTakeout → 불변', () => {
    const { s } = setup();
    s().switchPlace(GWC);
    s().increment('gwc', 'm1');
    expect(s().switchPlace(SSD).needsConfirm).toBe(true);
    expect(s().setTakeout(SSD, true)).toBe(false);
    expect(s().takeout).toBe(false);
    s().cancelSwitchPlace();
    expect(s().takeout).toBe(false);
  });

  it('R1 M-05: 매장 전용 현재 장소 → effectiveTakeout → 주문 문장에 포장 문구 없음', () => {
    const { s } = setup();
    const gwc = getPlace('gwc')!;
    s().switchPlace(SSD);
    s().setTakeout(SSD, true);
    s().switchPlace(gwc);
    s().setTakeout(SSD, true); // 다른 장소 호출은 무시
    const menu = gwc.menu ?? [];
    s().increment('gwc', menu[0].id);
    const sentence = buildOrderSentence(
      toOrderLines(menu, s().cart.gwc),
      effectiveTakeout(s().takeout, gwc),
    );
    expect(sentence?.ko).toBeTruthy();
    expect(sentence?.ko).not.toContain('포장');
  });

  it('문장 생성용 effectiveTakeout은 장소가 takeout:false면 항상 false', () => {
    expect(effectiveTakeout(true, GWC)).toBe(false);
    expect(effectiveTakeout(true, SSD)).toBe(true);
    expect(effectiveTakeout(false, SSD)).toBe(false);
    expect(effectiveTakeout(true, null)).toBe(false);
  });
});

describe('저장 (F-13)', () => {
  it('장소·문장 북마크 토글', () => {
    const { s } = setup();
    expect(s().toggleSavedPlace('ssd')).toBe(true);
    expect(s().toggleSavedPhrase('p1')).toBe(true);
    expect(s().saved).toEqual({ places: ['ssd'], phrases: ['p1'] });
    expect(s().toggleSavedPlace('ssd')).toBe(false);
    expect(s().saved.places).toEqual([]);
  });
});

describe('이용 기록·제보', () => {
  it('logEvent는 시각을 붙여 기록하고 500건 상한을 지킨다', () => {
    let t = 0;
    const { s } = setup(() => t++);
    for (let i = 0; i < MAX_EVENTS + 5; i++) s().logEvent({ type: 'screen_view', screen: 'home' });
    expect(s().events).toHaveLength(MAX_EVENTS);
    expect(s().events[0]).toEqual({ type: 'screen_view', screen: 'home', t: 5 });
  });

  it('addReport는 제보를 저장하고 report_sent 이벤트를 남긴다', () => {
    const { s } = setup(() => 42);
    s().addReport('price', 'ssd');
    s().addReport('other');
    expect(s().reports).toEqual([
      { kind: 'price', placeId: 'ssd', t: 42 },
      { kind: 'other', t: 42 },
    ]);
    expect(s().events).toEqual([
      { type: 'report_sent', kind: 'price', placeId: 'ssd', t: 42 },
      { type: 'report_sent', kind: 'other', t: 42 },
    ]);
  });

  it('clearEvents는 기록만, resetData는 언어 빼고 모두 비운다', () => {
    const { s } = setup();
    s().setLang('ja');
    s().switchPlace(SSD);
    s().increment('ssd', 'm1');
    s().toggleSavedPlace('ssd');
    s().addReport('closed', 'ssd');
    s().setWalkPick('downtown-halfday', 'mus'); // T6.13 고른 행선지
    s().clearEvents();
    expect(s().events).toEqual([]);
    expect(s().reports).toHaveLength(1);
    s().resetData();
    expect(s()).toMatchObject({
      lang: 'ja',
      cart: {},
      currentPlaceId: null,
      takeout: false,
      saved: { places: [], phrases: [] },
      reports: [],
      events: [],
      walkPicks: {},
    });
  });
});

describe('persist', () => {
  it('상태를 저장하고 새 store가 복원한다 (pendingPlace는 저장 안 함)', () => {
    const { storage, s } = setup();
    s().setLang('en');
    s().switchPlace(SSD);
    s().increment('ssd', 'm1');
    s().switchPlace(GWC);
    s().toggleSavedPhrase('p1');
    s().logEvent({ type: 'place_view', placeId: 'ssd' });

    const raw = JSON.parse(storage.getItem(STORAGE_KEY) as string);
    expect(raw.version).toBe(STORAGE_VERSION);
    expect(raw.state.pendingPlace).toBeUndefined();

    const s2 = createAppStore({ storage }).getState();
    expect(s2.lang).toBe('en');
    expect(s2.cart).toEqual({ ssd: { m1: 1 } });
    expect(s2.currentPlaceId).toBe('ssd');
    expect(s2.saved.phrases).toEqual(['p1']);
    expect(s2.events).toHaveLength(1);
    expect(s2.pendingPlace).toBeNull();
  });

  it('localStorage 접근이 막혀도 메모리로 동작한다', () => {
    const blocked = createSafeStorage(() => {
      throw new Error('SecurityError');
    });
    const store = createAppStore({ storage: blocked });
    store.getState().setLang('ja');
    store.getState().logEvent({ type: 'screen_view', screen: 'lang' });
    expect(blocked.mode).toBe('memory');
    expect(store.getState().lang).toBe('ja');
    expect(JSON.parse(blocked.getItem(STORAGE_KEY) as string).state.lang).toBe('ja');
  });

  it('쓰기가 매번 실패하는 localStorage에서도 상태 변경이 던지지 않는다', () => {
    const quota: Storage = {
      length: 0,
      clear: () => {},
      key: () => null,
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const store = createAppStore({ storage: createSafeStorage(() => quota) });
    expect(() => store.getState().setLang('zh')).not.toThrow();
    expect(store.getState().lang).toBe('zh');
  });

  it('손상된 JSON이면 기본값으로 시작', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const st = createAppStore({ storage }).getState();
    expect(st.lang).toBeNull();
    expect(st.events).toEqual([]);
  });

  it('모양이 틀린 저장값은 걸러서 복원', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        state: {
          lang: 'fr',
          cart: { ssd: { m1: 3, m2: 'x', m3: 0, m4: 99 }, bad: 5 },
          takeout: 'yes',
          saved: { places: ['ssd', 1], phrases: 'p1' },
          reports: [
            { kind: 'price', t: 1 },
            { kind: 'spam', t: 2 },
          ],
          events: [{ type: 'place_view', placeId: 'ssd', t: 1 }, { type: 'x' }],
        },
      }),
    );
    const st = createAppStore({ storage }).getState();
    expect(st.lang).toBeNull();
    expect(st.cart).toEqual({ ssd: { m1: 3, m4: 9 } });
    expect(st.takeout).toBe(false);
    expect(st.saved).toEqual({ places: ['ssd'], phrases: [] });
    expect(st.reports).toEqual([{ kind: 'price', t: 1 }]);
    expect(st.events).toEqual([{ type: 'place_view', placeId: 'ssd', t: 1 }]);
    expect(typeof st.switchPlace).toBe('function');
  });

  it('sanitizePersisted: 객체가 아니면 빈 값, 이벤트는 최근 500건만', () => {
    expect(sanitizePersisted(null)).toEqual({});
    const events = Array.from({ length: MAX_EVENTS + 3 }, (_, i) => ({
      type: 'screen_view',
      screen: 'home',
      t: i,
    }));
    const out = sanitizePersisted({ events });
    expect(out.events).toHaveLength(MAX_EVENTS);
    expect(out.events?.[0].t).toBe(3);
  });
});

describe('기본 store', () => {
  it('jsdom localStorage에 저장한다', () => {
    useAppStore.getState().setLang('en');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string).state.lang).toBe('en');
  });

  it('고른 행선지(walkPicks, T6.13)는 저장하지 않음 — 새로 열면 다음 정류장부터', () => {
    useAppStore.getState().setWalkPick('downtown-halfday', 'mus');
    expect(useAppStore.getState().walkPicks).toEqual({ 'downtown-halfday': 'mus' });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string).state;
    expect(saved).not.toHaveProperty('walkPicks');
    useAppStore.setState({ walkPicks: {} });
  });
});

describe('R2-L01: logEvent 반환값·화면 키', () => {
  it('정상 이벤트 → true, 1건 증가', () => {
    const { s } = setup();
    expect(s().logEvent({ type: 'screen_view', screen: 'order' })).toBe(true);
    expect(s().logEvent({ type: 'place_view', placeId: 'ssd' })).toBe(true);
    expect(s().events).toHaveLength(2);
  });

  it('잘못된 ID·화면 키 → false, events 불변', () => {
    const { s } = setup();
    s().logEvent({ type: 'screen_view', screen: 'home' });
    const before = s().events;
    expect(s().logEvent({ type: 'phrase_play', src: 'phrase', phraseId: 'SSD-1' })).toBe(false);
    expect(s().logEvent({ type: 'screen_view', screen: '/order' as never })).toBe(false);
    expect(s().logEvent({ type: 'screen_view', screen: 'hello' as never })).toBe(false);
    expect(s().events).toBe(before);
  });

  it('0분 ssd → 20분 order 화면 → 40분 gwc: 중간 screen_view가 세션을 이어 비율 1', () => {
    let t = 0;
    const { s } = setup(() => t);
    const MIN = 60 * 1000;
    s().logEvent({ type: 'place_view', placeId: 'ssd' });
    t = 20 * MIN;
    expect(s().logEvent({ type: 'screen_view', screen: 'order' })).toBe(true);
    t = 40 * MIN;
    s().logEvent({ type: 'place_view', placeId: 'gwc' });
    expect(extraVisitRate(s().events, 'ssd')).toEqual({ numerator: 1, denominator: 1, rate: 1 });
  });
});
