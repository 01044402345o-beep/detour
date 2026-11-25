/**
 * 영업 상태 (PRD F-04): 등록된 시간표를 Asia/Seoul 기준으로 본 참고값.
 * 실제 영업 여부는 현장에서 바뀔 수 있으므로 화면에는 place.statusNote를 함께 표시합니다.
 */
import type { Lang, Place } from '../../types';

export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Day = (typeof DAYS)[number];

export type OpenStatus = 'open' | 'closed';

const HOURS_RE = /^(\d{2}):(\d{2})[–-](\d{2}):(\d{2})$/;
const SEOUL = 'Asia/Seoul';

/** 'HH:MM–HH:MM' → 분 단위 [시작, 끝]. 형식이 틀리면 null */
export function parseHours(hours: string): [number, number] | null {
  const m = HOURS_RE.exec(hours.trim());
  if (!m) return null;
  const [h1, m1, h2, m2] = m.slice(1).map(Number);
  return [h1 * 60 + m1, h2 * 60 + m2];
}

/** 그 시각의 서울 요일·자정 이후 분 */
export function seoulClock(now: Date): { day: Day; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const day = get('weekday').toLowerCase().slice(0, 3) as Day;
  const hour = Number(get('hour')) % 24;
  return { day, minutes: hour * 60 + Number(get('minute')) };
}

function closedDays(closedOn: string | undefined): Day[] {
  return (closedOn ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter((d): d is Day => (DAYS as readonly string[]).includes(d));
}

/**
 * 등록된 시간표 기준 영업 상태. 시간표 형식을 읽을 수 없으면 null(표시 안 함).
 * 끝 시각이 시작보다 이르면 자정을 넘기는 영업으로 봅니다.
 * 휴무 요일 정책: 휴무 요일은 "그날 시작하는 영업이 없다"는 뜻입니다(T2.3 R1 M-01).
 * 따라서 자정 넘김 영업의 자정 이후 시간대는 전날의 휴무 여부를 봅니다.
 * 예) 18:00–02:00, 월 휴무 → 월 01:00 영업(일요일 영업의 연장), 화 01:00 영업 종료.
 */
export function openStatus(
  place: Pick<Place, 'hours' | 'closedOn'>,
  now: Date = new Date(),
): OpenStatus | null {
  const range = parseHours(place.hours);
  if (!range) return null;
  const { day, minutes } = seoulClock(now);
  const closed = closedDays(place.closedOn);
  const [start, end] = range;
  const idx = DAYS.indexOf(day);
  const prevDay = DAYS[(idx + 6) % 7];
  let open: boolean;
  if (end > start) {
    open = !closed.includes(day) && minutes >= start && minutes < end;
  } else if (minutes >= start) {
    open = !closed.includes(day); // 오늘 시작한 영업
  } else if (minutes < end) {
    open = !closed.includes(prevDay); // 전날 시작해 자정을 넘긴 영업
  } else {
    open = false;
  }
  return open ? 'open' : 'closed';
}

/** 휴무 요일을 사용자 언어 요일 이름으로 ('mon' → 'Mon' / '月' / '周一'). 없으면 null */
export function closedDaysLabel(closedOn: string | undefined, lang: Lang): string | null {
  const days = closedDays(closedOn);
  if (days.length === 0) return null;
  // 2024-01-07(UTC)은 일요일 — DAYS 순서와 같은 날짜를 만들어 이름만 꺼냅니다
  const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' });
  const names = days.map((d) => fmt.format(new Date(Date.UTC(2024, 0, 7 + DAYS.indexOf(d)))));
  return new Intl.ListFormat(lang, { type: 'conjunction', style: 'narrow' }).format(names);
}

/** 요일 하나를 사용자 언어 짧은 이름으로 ('mon' → 'Mon' / '月' / '周一') */
export function dayLabel(day: Day, lang: Lang): string {
  const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' });
  return fmt.format(new Date(Date.UTC(2024, 0, 7 + DAYS.indexOf(day))));
}

/** 자정 이후 분 → 'HH:MM' */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type NextOpening = {
  /** 0 = 오늘, 1 = 내일, 2~7 = 그 요일 */
  inDays: number;
  day: Day;
  /** 'HH:MM' (서울 시각) */
  time: string;
};

/**
 * 지금 닫혀 있을 때 다음 영업 시작 시각 (등록된 시간표·휴무 요일 기준, Asia/Seoul).
 * 시간표를 읽을 수 없거나 지금 영업 중이면 null. 휴무 요일은 "그날 시작하는 영업이 없다"는 뜻(openStatus와 같음).
 */
export function nextOpening(
  place: Pick<Place, 'hours' | 'closedOn'>,
  now: Date = new Date(),
): NextOpening | null {
  const range = parseHours(place.hours);
  if (!range || openStatus(place, now) !== 'closed') return null;
  const [start] = range;
  const { day, minutes } = seoulClock(now);
  const closed = closedDays(place.closedOn);
  const idx = DAYS.indexOf(day);
  for (let inDays = 0; inDays <= 7; inDays++) {
    const d = DAYS[(idx + inDays) % 7];
    if (closed.includes(d)) continue;
    if (inDays === 0 && minutes >= start) continue; // 오늘 시작 시각은 이미 지남
    return { inDays, day: d, time: formatMinutes(start) };
  }
  return null;
}
