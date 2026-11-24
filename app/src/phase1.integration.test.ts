/**
 * Phase 1 통합 검증 (coordinator 작성, task.md 0.3절 Phase 1·2 "실제 모듈 연결 단위 테스트").
 * mock 없이 실제 모듈끼리 연결해 데이터 → 장바구니(store) → 주문 문장 → 채점 → 이용 기록이 이어지는지 확인합니다.
 */
import { describe, expect, it } from 'vitest';
import { getPlace, places } from './data';
import { buildOrderSentence, toOrderLines } from './domain/orderSentence';
import { scoreSpeech } from './domain/scoring';
import { extraVisitRate } from './domain/events';
import { createAppStore, effectiveTakeout } from './store/useAppStore';
import { createMemoryStorage } from './store/safeStorage';
import { t } from './i18n';

function newStore() {
  let clock = 1_000_000;
  return createAppStore({ storage: createMemoryStorage(), now: () => (clock += 1000) });
}

describe('Phase 1 통합: 데이터 → store → 주문 문장 → 채점 → 기록', () => {
  it('성심당: 튀김소보로 2·판타롱부추빵 1 포장 → 검수표 기대 문장, 그대로 말하면 100점', () => {
    const store = newStore();
    const ssd = getPlace('ssd')!;
    expect(store.getState().switchPlace(ssd).needsConfirm).toBe(false);
    store.getState().setQty('ssd', 'tw', 2);
    store.getState().increment('ssd', 'bu');
    store.getState().setTakeout(ssd, true);

    const s = store.getState();
    const lines = toOrderLines(ssd.menu ?? [], s.cart.ssd ?? {});
    const sentence = buildOrderSentence(lines, effectiveTakeout(s.takeout, ssd))!;
    expect(sentence.ko).toBe('튀김소보로 두 개, 판타롱부추빵 한 개 주세요. 포장해 주세요.');

    const exact = scoreSpeech(sentence.ko, sentence.ko);
    expect(exact.status).toBe('scored');
    if (exact.status === 'scored') expect(exact.score).toBe(100);

    // 브라우저 인식이 숫자로 돌려주는 경우도 같은 문장으로 인정
    const digits = scoreSpeech(sentence.ko, '튀김소보로 2개 판타롱부추빵 1개 주세요 포장해 주세요');
    if (digits.status === 'scored') expect(digits.score).toBe(100);
    else throw new Error('digits not scored');
  });

  it('광천식당: 포장 불가 장소는 포장을 켜도 문장에 "포장해 주세요"가 없음, 인분은 한자어', () => {
    const store = newStore();
    const gwc = getPlace('gwc')!;
    store.getState().switchPlace(gwc);
    store.getState().setQty('gwc', 'dt', 2);
    store.getState().setTakeout(gwc, true);
    const s = store.getState();
    const sentence = buildOrderSentence(
      toOrderLines(gwc.menu ?? [], s.cart.gwc ?? {}),
      effectiveTakeout(s.takeout, gwc),
    )!;
    expect(sentence.ko).toBe('두부두루치기 2인분 주세요.');
  });

  it('장소 전환: 성심당 주문이 남아 있으면 확인 요청, 확인 후 주문이 비워짐', () => {
    const store = newStore();
    store.getState().switchPlace(getPlace('ssd')!);
    store.getState().setQty('ssd', 'tw', 1);
    expect(store.getState().switchPlace(getPlace('gwc')!).needsConfirm).toBe(true);
    store.getState().confirmSwitchPlace();
    expect(store.getState().currentPlaceId).toBe('gwc');
    expect(Object.keys(store.getState().cart.ssd ?? {})).toHaveLength(0);
  });

  it('이용 기록: 실제 장소 ID로 기록하면 추가 방문 비율이 계산됨', () => {
    const store = newStore();
    expect(store.getState().logEvent({ type: 'place_view', placeId: 'ssd' })).toBe(true);
    expect(store.getState().logEvent({ type: 'screen_view', screen: 'order' })).toBe(true);
    expect(store.getState().logEvent({ type: 'place_view', placeId: 'gwc' })).toBe(true);
    expect(extraVisitRate(store.getState().events, 'ssd').rate).toBe(1);
  });

  it('데이터·사전 연결: 2개 코스 8곳 모두 현장 확인 전이며 확인 전 문구가 3개 언어로 있음', () => {
    expect(places.map((p) => p.id)).toEqual(['ssd', 'eun', 'mus', 'gwc', 'sy', 'gc', 'sj', 'hg']);
    expect(places.every((p) => p.verified === false)).toBe(true);
    for (const lang of ['en', 'ja', 'zh'] as const) {
      const text = t(lang, 'place.unverified');
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toBe('place.unverified');
    }
  });
});
