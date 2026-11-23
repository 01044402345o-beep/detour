/**
 * 직원 화면(S08) 표시 내용 계산 (T2.5, PRD F-10).
 * - src 'order': store의 현재 주문(cart·currentPlaceId·takeout)으로 주문 문장을 만듭니다.
 * - src 'phrase': downtown.json에서 문장 ID를 찾아 그 문장만 보여줍니다(주문 목록 없음).
 * - 입력이 없거나(직접 진입·새로고침) 문장 ID가 데이터에 없으면 현재 주문으로 대신합니다.
 *   현재 주문도 비어 있으면 null → 화면이 빈 주문 안내를 보여줍니다.
 */
import { getPlace, places, type ContentPlace } from '../../data';
import { buildOrderSentence, toOrderLines, type OrderLine } from '../../domain/orderSentence';
import type { PhraseInputState } from '../../router/navState';
import { effectiveTakeout, type Cart } from '../../store/useAppStore';
import type { OrderSentence, Phrase } from '../../types';

export type StaffContent =
  | {
      kind: 'order';
      place: ContentPlace;
      sentence: OrderSentence;
      lines: OrderLine[];
      /** 문장 생성에 쓴 포장 여부 (effectiveTakeout) */
      takeout: boolean;
    }
  | { kind: 'phrase'; place: ContentPlace; phrase: Phrase };

export type OrderSnapshot = { cart: Cart; currentPlaceId: string | null; takeout: boolean };

/** 문장 ID → 문장과 그 문장이 속한 장소 (없으면 null) */
export function findPhrase(phraseId: string): { place: ContentPlace; phrase: Phrase } | null {
  for (const place of places) {
    const phrase = place.phrases.find((p) => p.id === phraseId);
    if (phrase) return { place, phrase };
  }
  return null;
}

/** 현재 주문으로 만든 직원 화면 내용 (빈 주문·메뉴 없는 장소면 null) */
export function orderContent(order: OrderSnapshot): StaffContent | null {
  const place = order.currentPlaceId ? getPlace(order.currentPlaceId) : undefined;
  if (!place?.menu) return null;
  const lines = toOrderLines(place.menu, order.cart[place.id] ?? {});
  const takeout = effectiveTakeout(order.takeout, place);
  let sentence: OrderSentence | null;
  try {
    sentence = buildOrderSentence(lines, takeout);
  } catch {
    sentence = null; // 손상된 수량 — store가 막지만 화면은 깨지지 않게
  }
  return sentence ? { kind: 'order', place, sentence, lines, takeout } : null;
}

export function resolveStaffContent(
  input: PhraseInputState | null,
  order: OrderSnapshot,
): StaffContent | null {
  if (input?.src === 'phrase') {
    const found = findPhrase(input.phraseId);
    if (found) return { kind: 'phrase', ...found };
  }
  return orderContent(order);
}

/** 화면에 크게 보일 한국어 문장 */
export function staffKo(content: StaffContent): string {
  return content.kind === 'order' ? content.sentence.ko : content.phrase.ko;
}

/** 큰 문장 글자 크기 (목업 S08: 22자 초과면 27/34px, 이하면 34/44px) */
export function staffFontSize(ko: string, big: boolean): number {
  if (ko.length > 22) return big ? 34 : 27;
  return big ? 44 : 34;
}
