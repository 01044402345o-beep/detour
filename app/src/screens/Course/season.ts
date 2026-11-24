/**
 * 시즌 행사(야시장·축제) 상태 (T5.1). 기간·요일·시간은 Asia/Seoul 기준 참고값입니다.
 * 화면 문구는 SeasonCard가 i18n으로 만들고, 여기서는 상태와 날짜만 계산합니다.
 */
import type { SeasonEvent } from '../../types';
import { DAYS, parseHours, seoulClock, type Day } from '../Place/hours';

export type SeasonStatus =
  /** 지금 열려 있음 */
  | { kind: 'open' }
  /** 오늘 열리지만 아직 시작 전 */
  | { kind: 'today' }
  /** 다음에 여는 날 (오늘 이후, 기간 안) */
  | { kind: 'next'; date: string }
  /** 기간 시작 전 (첫 개장일) */
  | { kind: 'upcoming'; date: string }
  /** 이번 시즌 끝남 */
  | { kind: 'ended' };

/** 그 시각의 서울 날짜 'YYYY-MM-DD' */
export function seoulDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** 'YYYY-MM-DD' + n일 */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD'의 요일 */
export function weekdayOf(date: string): Day {
  return DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function openDays(ev: Pick<SeasonEvent, 'days'>): Day[] {
  return ev.days
    .split(',')
    .map((d) => d.trim())
    .filter((d): d is Day => (DAYS as readonly string[]).includes(d));
}

/** from(포함)부터 기간 안에서 처음 여는 날. 없으면 null */
function firstOpenDay(ev: SeasonEvent, from: string): string | null {
  const days = openDays(ev);
  let d = from < ev.startDate ? ev.startDate : from;
  for (let i = 0; i < 7 && d <= ev.endDate; i += 1, d = addDays(d, 1)) {
    if (days.includes(weekdayOf(d))) return d;
  }
  return null;
}

export function seasonStatus(ev: SeasonEvent, now: Date = new Date()): SeasonStatus {
  const today = seoulDate(now);
  if (today > ev.endDate) return { kind: 'ended' };
  if (today < ev.startDate) {
    const first = firstOpenDay(ev, ev.startDate);
    return first ? { kind: 'upcoming', date: first } : { kind: 'ended' };
  }
  const range = parseHours(ev.hours);
  if (openDays(ev).includes(weekdayOf(today)) && range) {
    const { minutes } = seoulClock(now);
    const [start, end] = range;
    if (minutes < start) return { kind: 'today' };
    if (minutes < end) return { kind: 'open' };
  }
  const next = firstOpenDay(ev, addDays(today, 1));
  return next ? { kind: 'next', date: next } : { kind: 'ended' };
}
