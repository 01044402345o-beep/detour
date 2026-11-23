import { describe, expect, it } from 'vitest';
import { closedDaysLabel, openStatus, parseHours, seoulClock } from './hours';

describe('hours', () => {
  it('parseHours: en dash·하이픈, 24:00', () => {
    expect(parseHours('08:00–22:00')).toEqual([480, 1320]);
    expect(parseHours('00:00-24:00')).toEqual([0, 1440]);
    expect(parseHours('Always open')).toBeNull();
  });

  it('seoulClock: UTC를 서울(+9) 요일·분으로', () => {
    expect(seoulClock(new Date('2026-11-23T15:30:00Z'))).toEqual({ day: 'tue', minutes: 30 });
    expect(seoulClock(new Date('2026-11-23T03:00:00Z'))).toEqual({ day: 'mon', minutes: 720 });
  });

  it('openStatus: 시간표·휴무일 기준, 끝 시각 직전까지 영업', () => {
    const p = { hours: '10:00–18:00', closedOn: 'mon' };
    expect(openStatus(p, new Date('2026-11-24T00:59:00Z'))).toBe('closed'); // 화 09:59
    expect(openStatus(p, new Date('2026-11-24T01:00:00Z'))).toBe('open'); // 화 10:00
    expect(openStatus(p, new Date('2026-11-24T08:59:00Z'))).toBe('open'); // 화 17:59
    expect(openStatus(p, new Date('2026-11-24T09:00:00Z'))).toBe('closed'); // 화 18:00
    expect(openStatus(p, new Date('2026-11-23T03:00:00Z'))).toBe('closed'); // 월 휴무
  });

  it('openStatus: 24시간·자정 넘김·형식 오류', () => {
    expect(openStatus({ hours: '00:00–24:00' }, new Date('2026-11-23T14:59:00Z'))).toBe('open');
    const late = { hours: '18:00–02:00' };
    expect(openStatus(late, new Date('2026-11-23T16:00:00Z'))).toBe('open'); // 01:00
    expect(openStatus(late, new Date('2026-11-23T08:00:00Z'))).toBe('closed'); // 17:00
    expect(openStatus({ hours: 'n/a' })).toBeNull();
  });

  it('openStatus: 자정 넘김 + 휴무일 — 자정 이후는 전날 휴무 여부로 판단 (R1 M-01)', () => {
    const p = { hours: '18:00–02:00', closedOn: 'mon' };
    const at = (iso: string) => openStatus(p, new Date(iso));
    // 서울 = UTC+9. 2026-11-23은 월요일
    expect(at('2026-11-22T16:00:00Z')).toBe('open'); // 월 01:00 (일요일 영업의 연장)
    expect(at('2026-11-22T16:59:00Z')).toBe('open'); // 월 01:59
    expect(at('2026-11-22T17:00:00Z')).toBe('closed'); // 월 02:00
    expect(at('2026-11-23T10:00:00Z')).toBe('closed'); // 월 19:00 (휴무일에 시작하는 영업 없음)
    expect(at('2026-11-23T16:00:00Z')).toBe('closed'); // 화 01:00 (월요일 영업 없음)
    expect(at('2026-11-23T16:59:00Z')).toBe('closed'); // 화 01:59
    expect(at('2026-11-23T17:00:00Z')).toBe('closed'); // 화 02:00
    expect(at('2026-11-24T09:00:00Z')).toBe('open'); // 화 18:00
  });

  it('openStatus 회귀: 24시간은 휴무 없으면 늘 영업, 같은 날 끝나는 영업의 휴무일', () => {
    const allDay = { hours: '00:00–24:00' };
    for (const iso of ['2026-11-22T15:00:00Z', '2026-11-23T03:00:00Z', '2026-11-23T14:59:00Z']) {
      expect(openStatus(allDay, new Date(iso))).toBe('open');
    }
    const hall = { hours: '10:00–18:00', closedOn: 'mon' };
    expect(openStatus(hall, new Date('2026-11-23T03:00:00Z'))).toBe('closed'); // 월 12:00
    expect(openStatus(hall, new Date('2026-11-24T03:00:00Z'))).toBe('open'); // 화 12:00
  });

  it('closedDaysLabel: 사용자 언어 요일 이름', () => {
    expect(closedDaysLabel('mon', 'en')).toBe('Mon');
    expect(closedDaysLabel('mon', 'ja')).toBe('月');
    expect(closedDaysLabel('mon', 'zh')).toBe('周一');
    expect(closedDaysLabel('sat,sun', 'en')).toMatch(/Sat.*Sun/);
    expect(closedDaysLabel(undefined, 'en')).toBeNull();
  });
});
