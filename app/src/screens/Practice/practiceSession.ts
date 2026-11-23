/**
 * 말하기 연습(S06)·채점 결과(S07) 공용 로직 (T2.4).
 * - 입력: router state. 기본 계약은 router/navState의 PhraseInputState이고, 연습 목록을 이어 가려고
 *   `withOrder: true`(목록 맨 앞에 주문 문장이 있음)만 덧붙입니다. 검증은 parsePhraseInput을 그대로 씁니다.
 * - 목록: src 'order' → [주문 문장, 그 장소 문장들…] / src 'phrase' → 그 문장이 속한 장소의 문장들
 *   (목업 buildPractice와 같음). 실제 문장은 data(downtown.json)에서 찾고, 없으면 null.
 */
import { getPlace, places, type ContentPlace } from '../../data';
import type { AppEventInput, PhraseSource } from '../../domain/events';
import { buildOrderSentence, toOrderLines } from '../../domain/orderSentence';
import { parsePhraseInput, phraseInput, type PhraseInputState } from '../../router/navState';
import { effectiveTakeout, useAppStore, type Cart } from '../../store/useAppStore';
import type { L10n } from '../../types';

/** 연습 화면 입력 상태 = 공용 계약 + 목록 이어 가기 표시 */
export type PracticeNav = PhraseInputState & { withOrder?: true };

export type PracticeItem = {
  kind: PhraseSource;
  /** 목록 안 고유 키 ('order' 또는 문장 ID) */
  key: string;
  placeId: string;
  phraseId?: string;
  ko: string;
  roman: string;
  kana: string;
  meaning: L10n;
  words: { ko: string; meaning: L10n }[];
};

export type PracticeSession = {
  place: ContentPlace;
  list: PracticeItem[];
  index: number;
  item: PracticeItem;
  /** 목록 맨 앞이 주문 문장인지 */
  hasOrder: boolean;
};

export type OrderContext = { cart: Cart; currentPlaceId: string | null; takeout: boolean };

export function parsePracticeNav(state: unknown): PracticeNav | null {
  const base = parsePhraseInput(state);
  if (!base) return null;
  const withOrder = (state as Record<string, unknown>).withOrder === true;
  return base.src === 'phrase' && withOrder ? { ...base, withOrder: true } : base;
}

function orderItem(place: ContentPlace, ctx: OrderContext): PracticeItem | null {
  if (ctx.currentPlaceId !== place.id || !place.menu) return null;
  let sentence;
  try {
    sentence = buildOrderSentence(
      toOrderLines(place.menu, ctx.cart[place.id] ?? {}),
      effectiveTakeout(ctx.takeout, place),
    );
  } catch {
    return null; // 저장소 값이 깨진 경우 — 빈 주문과 같이 처리
  }
  if (!sentence) return null;
  return {
    kind: 'order',
    key: 'order',
    placeId: place.id,
    ko: sentence.ko,
    roman: sentence.roman,
    kana: sentence.kana,
    meaning: sentence.meaning,
    words: sentence.words.map((w) => ({ ko: w.ko, meaning: w.meaning })),
  };
}

function phraseItems(place: ContentPlace): PracticeItem[] {
  return place.phrases.map((ph) => ({
    kind: 'phrase',
    key: ph.id,
    placeId: place.id,
    phraseId: ph.id,
    ko: ph.ko,
    roman: ph.roman,
    kana: ph.kana,
    meaning: ph.meaning,
    words: ph.words.map((w) => ({ ko: w.ko, meaning: w.meaning })),
  }));
}

/** 입력 상태 → 연습 목록과 현재 문장. 주문이 비었거나 문장이 데이터에 없으면 null */
export function resolveSession(nav: PracticeNav, ctx: OrderContext): PracticeSession | null {
  if (nav.src === 'order') {
    const place = ctx.currentPlaceId ? getPlace(ctx.currentPlaceId) : undefined;
    const order = place && orderItem(place, ctx);
    if (!place || !order) return null;
    const list = [order, ...phraseItems(place)];
    return { place, list, index: 0, item: order, hasOrder: true };
  }
  const place = places.find((p) => p.phrases.some((ph) => ph.id === nav.phraseId));
  if (!place) return null;
  const order = nav.withOrder ? orderItem(place, ctx) : null;
  const list = order ? [order, ...phraseItems(place)] : phraseItems(place);
  const index = list.findIndex((it) => it.phraseId === nav.phraseId);
  return { place, list, index, item: list[index], hasOrder: !!order };
}

/** 목록 안 한 문장으로 가는 입력 상태 */
export function navForItem(item: PracticeItem, hasOrder: boolean): PracticeNav {
  if (item.kind === 'order' || !item.phraseId) return phraseInput('order');
  const base = phraseInput('phrase', item.phraseId);
  return hasOrder ? { ...base, withOrder: true } : base;
}

/** 다음 문장 (마지막이면 처음으로 — 목업 S07 '다음 문장') */
export function nextNav(s: PracticeSession): PracticeNav {
  return navForItem(s.list[(s.index + 1) % s.list.length], s.hasOrder);
}

/** 직원 화면(S08) 입력 상태 — 공용 계약 그대로 */
export function staffInput(item: PracticeItem): PhraseInputState {
  return item.kind === 'order' || !item.phraseId
    ? phraseInput('order')
    : phraseInput('phrase', item.phraseId);
}

/** 이용 기록 공통 필드 (실제 데이터 ID) */
export function eventRef(item: PracticeItem) {
  return {
    src: item.kind,
    placeId: item.placeId,
    ...(item.phraseId ? { phraseId: item.phraseId } : {}),
  };
}

/** store.logEvent 호출. 버려지면 개발 모드에서 경고 (T1.6 R2) */
export function logPracticeEvent(event: AppEventInput): boolean {
  const ok = useAppStore.getState().logEvent(event);
  if (!ok && import.meta.env.DEV) console.warn('[practice] event dropped', event);
  return ok;
}

/** 앱 안에서 쌓인 이전 화면이 있는지 (React Router history.state.idx) */
export function hasInAppHistory(): boolean {
  const state = window.history.state as { idx?: unknown } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

/** 긴 문장은 글자를 줄입니다 (목업: 18자 초과 22px, 아니면 27px) */
export function sentenceFontSize(ko: string): number {
  return ko.length > 18 ? 22 : 27;
}
