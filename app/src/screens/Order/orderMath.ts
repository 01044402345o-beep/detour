/**
 * 주문 금액 표시 (PRD F-05). 가격은 현장 확인 전 예시값입니다.
 * 담은 항목 중 가격 미확인(priceKrw 없음)이 하나라도 있으면 합계는 null → '총액 확인 필요'.
 */
import type { OrderLine } from '../../domain/orderSentence';

/** ₩1,700 (목업과 같이 언어와 관계없이 원화 기호 + 천 단위 쉼표) */
export function formatKrw(n: number): string {
  return `₩${n.toLocaleString('en-US')}`;
}

/** 줄 금액. 가격 미확인이면 null */
export function lineTotal({ item, qty }: OrderLine): number | null {
  return item.priceKrw === undefined ? null : item.priceKrw * qty;
}

/** 합계 예시가. 빈 주문이거나 가격 미확인 항목이 있으면 null */
export function orderTotal(lines: readonly OrderLine[]): number | null {
  if (lines.length === 0) return null;
  let sum = 0;
  for (const line of lines) {
    const v = lineTotal(line);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

/** 담은 수량 합계 */
export function orderCount(lines: readonly OrderLine[]): number {
  return lines.reduce((a, l) => a + l.qty, 0);
}
