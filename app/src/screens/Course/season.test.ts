import { describe, expect, it } from 'vitest';
import type { SeasonEvent } from '../../types';
import { seasonStatus, seoulDate, weekdayOf } from './season';

// 토토즐 푸드페스타 2026: 8/14(금)~11/28(토), 금·토 18:00–22:00
const EV: SeasonEvent = {
  id: 'ev',
  nameKo: '야시장',
  name: { en: 'x', ja: 'x', zh: 'x' },
  where: { en: 'x', ja: 'x', zh: 'x' },
  description: { en: 'x', ja: 'x', zh: 'x' },
  startDate: '2026-08-14',
  endDate: '2026-11-28',
  days: 'fri,sat',
  hours: '18:00–22:00',
  source: 's',
  checkedAt: '2026-11-24',
  verified: false,
};
/** 서울 시각 (UTC+9) */
const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('시즌 행사 상태 (Asia/Seoul, T5.1)', () => {
  it('요일·날짜 계산', () => {
    expect(weekdayOf('2026-08-14')).toBe('fri');
    expect(weekdayOf('2026-11-28')).toBe('sat');
    // 서울은 UTC보다 9시간 빠름: UTC 11/27 20:00 = 서울 11/28 05:00
    expect(seoulDate(new Date('2026-11-27T20:00:00Z'))).toBe('2026-11-28');
  });

  it('시작 전 → 첫 개장일', () => {
    expect(seasonStatus(EV, kst('2026-08-01T12:00:00'))).toEqual({
      kind: 'upcoming',
      date: '2026-08-14',
    });
  });

  it('여는 날 시작 전 → today, 운영 중 → open, 끝난 뒤 → 다음 개장일', () => {
    expect(seasonStatus(EV, kst('2026-11-27T17:59:00'))).toEqual({ kind: 'today' });
    expect(seasonStatus(EV, kst('2026-11-27T18:00:00'))).toEqual({ kind: 'open' });
    expect(seasonStatus(EV, kst('2026-11-27T21:59:00'))).toEqual({ kind: 'open' });
    expect(seasonStatus(EV, kst('2026-11-27T22:00:00'))).toEqual({
      kind: 'next',
      date: '2026-11-28',
    });
  });

  it('여는 날이 아니면 다음 금·토 (예: 11/24 화 → 11/27 금)', () => {
    expect(seasonStatus(EV, kst('2026-11-24T10:00:00'))).toEqual({
      kind: 'next',
      date: '2026-11-27',
    });
  });

  it('마지막 날 운영 후·기간 뒤 → ended', () => {
    expect(seasonStatus(EV, kst('2026-11-28T22:30:00'))).toEqual({ kind: 'ended' });
    expect(seasonStatus(EV, kst('2026-12-05T19:00:00'))).toEqual({ kind: 'ended' });
  });
});
