import { describe, expect, it } from 'vitest';
import { getPlace } from '../../data';
import { toOrderLines } from '../../domain/orderSentence';
import { formatKrw, lineTotal, orderCount, orderTotal } from './orderMath';

const ssd = getPlace('ssd')!.menu!;

describe('orderMath', () => {
  it('formatKrw', () => {
    expect(formatKrw(1700)).toBe('₩1,700');
    expect(formatKrw(12000)).toBe('₩12,000');
  });

  it('합계: 모든 가격 확인 시에만 숫자', () => {
    const lines = toOrderLines(ssd, { tw: 2, bu: 1 });
    expect(orderTotal(lines)).toBe(5400);
    expect(orderCount(lines)).toBe(3);
    expect(lineTotal(lines[0])).toBe(3400);
  });

  it('가격 미확인 항목이 하나라도 있거나 빈 주문이면 null', () => {
    const lines = toOrderLines(ssd, { tw: 1, bm: 1 });
    expect(lineTotal(lines[1])).toBeNull();
    expect(orderTotal(lines)).toBeNull();
    expect(orderTotal([])).toBeNull();
  });
});
