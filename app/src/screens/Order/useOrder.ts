/**
 * 화면용 주문 상태 (S03 주문 바·S05 내 주문 공용).
 * 문장 생성은 domain/orderSentence, 포장 여부는 store의 effectiveTakeout (T1.6 R1).
 */
import { useMemo } from 'react';
import { getPlace, type ContentPlace } from '../../data';
import { buildOrderSentence, toOrderLines, type OrderLine } from '../../domain/orderSentence';
import { MAX_QTY, effectiveTakeout, useAppStore } from '../../store/useAppStore';
import type { OrderSentence } from '../../types';
import { orderCount, orderTotal } from './orderMath';

export type OrderView = {
  /** 지금 주문 중인 장소 (없으면 null) */
  place: ContentPlace | null;
  lines: OrderLine[];
  count: number;
  /** 합계 예시가. 가격 미확인 항목이 있거나 빈 주문이면 null */
  total: number | null;
  /** 문장에 반영되는 포장 여부 (`takeout:false` 장소는 항상 false) */
  takeout: boolean;
  sentence: OrderSentence | null;
};

const NO_ITEMS: Readonly<Record<string, number>> = {};

/** 현재 주문(store cart·currentPlaceId·takeout)을 화면 값으로 */
export function useOrderView(): OrderView {
  const currentPlaceId = useAppStore((s) => s.currentPlaceId);
  const items = useAppStore((s) => (s.currentPlaceId ? s.cart[s.currentPlaceId] : undefined));
  const rawTakeout = useAppStore((s) => s.takeout);
  return useMemo(() => {
    const place = (currentPlaceId && getPlace(currentPlaceId)) || null;
    const lines = place?.menu ? toOrderLines(place.menu, items ?? NO_ITEMS) : [];
    const takeout = effectiveTakeout(rawTakeout, place);
    return {
      place,
      lines,
      count: orderCount(lines),
      total: orderTotal(lines),
      takeout,
      sentence: buildOrderSentence(lines, takeout),
    };
  }, [currentPlaceId, items, rawTakeout]);
}

/** 이미 9개면 true (더 담지 못함 → 안내 토스트) */
export function isAtMax(qty: number): boolean {
  return qty >= MAX_QTY;
}
