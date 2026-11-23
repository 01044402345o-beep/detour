/**
 * 이용 기록 이벤트와 지표 계산 (T1.6, PRD F-15·F-16a).
 * 개인정보·음성 인식 원문은 담지 않습니다. 모두 순수 함수입니다.
 */

/** 기기에 보관하는 최대 이벤트 수. 넘으면 오래된 것부터 버립니다. */
export const MAX_EVENTS = 500;

/** 세션 구분 기준: 30분 무활동 */
export const SESSION_GAP_MS = 30 * 60 * 1000;

export const EVENT_TYPES = [
  'screen_view',
  'place_view',
  'phrase_play',
  'practice_done',
  'staff_shown',
  'report_sent',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * 화면 키 (PRD 5장 S00~S13, task.md T2.0 라우트 표와 1:1).
 * 라우트 경로(`location.pathname`)를 그대로 넘기지 않습니다: `/` → `home`, `/place/:id` → `place`
 * (S03·S04는 같은 `place`, 장소 ID는 별도 `place_view`로 남깁니다).
 */
export const SCREEN_KEYS = [
  'lang', // S00 /lang
  'home', // S01 /
  'course', // S02 /course
  'place', // S03·S04 /place/:id
  'order', // S05 /order
  'practice', // S06 /practice
  'result', // S07 /result
  'staff', // S08 /staff
  'reply', // S09 /reply
  'phrases', // S10 /phrases
  'saved', // S11 /saved
  'settings', // S12 /settings
  'report', // S13 /report
] as const;

export type ScreenKey = (typeof SCREEN_KEYS)[number];

export function isScreenKey(v: unknown): v is ScreenKey {
  return SCREEN_KEYS.includes(v as ScreenKey);
}

/** 연습·직원 화면의 입력 출처 (T2.0 계약 `{ src: 'order'|'phrase' }`) */
export type PhraseSource = 'order' | 'phrase';

/** 제보 종류 (F-14: 영업 종료·메뉴 변경·가격 변경·기타) */
export type ReportKind = 'closed' | 'menu' | 'price' | 'other';

export const REPORT_KINDS: readonly ReportKind[] = ['closed', 'menu', 'price', 'other'];

/** 이벤트 본문 (시각 제외). 자유 입력 문자열은 받지 않습니다. */
export type AppEventInput =
  | { type: 'screen_view'; screen: ScreenKey }
  | { type: 'place_view'; placeId: string }
  | { type: 'phrase_play'; src: PhraseSource; placeId?: string; phraseId?: string }
  | {
      type: 'practice_done';
      src: PhraseSource;
      placeId?: string;
      phraseId?: string;
      /** 인식 일치도 0~100. 인식 결과가 비면 생략 */
      score?: number;
    }
  | { type: 'staff_shown'; src: PhraseSource; placeId?: string; phraseId?: string }
  | { type: 'report_sent'; kind: ReportKind; placeId?: string };

/** 기록된 이벤트. `t` = epoch ms */
export type AppEvent = AppEventInput & { t: number };

/** 상한을 지키며 이벤트를 덧붙입니다. 원본 배열은 바꾸지 않습니다. */
export function appendEvent(
  events: readonly AppEvent[],
  event: AppEvent,
  max: number = MAX_EVENTS,
): AppEvent[] {
  const next = [...events, event];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** 시각순으로 정렬한 뒤 30분 무활동 간격마다 세션을 나눕니다. */
export function splitSessions(
  events: readonly AppEvent[],
  gapMs: number = SESSION_GAP_MS,
): AppEvent[][] {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const sessions: AppEvent[][] = [];
  let current: AppEvent[] = [];
  for (const e of sorted) {
    const last = current[current.length - 1];
    if (last && e.t - last.t >= gapMs) {
      sessions.push(current);
      current = [];
    }
    current.push(e);
  }
  if (current.length) sessions.push(current);
  return sessions;
}

export type Ratio = {
  numerator: number;
  denominator: number;
  /** 분모가 0이면 null */
  rate: number | null;
};

/** 세션 안에서 기준 장소 첫 열람 이후 처음 연 다른 장소 id (없으면 null) */
function nextPlaceAfter(
  session: readonly AppEvent[],
  anchorPlaceId: string,
): string | null | undefined {
  const start = session.findIndex((e) => e.type === 'place_view' && e.placeId === anchorPlaceId);
  if (start < 0) return undefined; // 기준 장소 열람 없음
  for (let i = start + 1; i < session.length; i++) {
    const e = session[i];
    if (e.type === 'place_view' && e.placeId !== anchorPlaceId) return e.placeId;
  }
  return null;
}

/**
 * 추가 방문 비율 (task.md T1.6, F-15).
 * 분자: 기준 장소(성심당) `place_view` 이후 같은 세션에서 다른 정류장 `place_view`가 있는 세션 수
 * 분모: 기준 장소 `place_view`가 있는 세션 수
 */
export function extraVisitRate(
  events: readonly AppEvent[],
  anchorPlaceId: string,
  gapMs: number = SESSION_GAP_MS,
): Ratio {
  let numerator = 0;
  let denominator = 0;
  for (const s of splitSessions(events, gapMs)) {
    const next = nextPlaceAfter(s, anchorPlaceId);
    if (next === undefined) continue;
    denominator++;
    if (next !== null) numerator++;
  }
  return { numerator, denominator, rate: denominator ? numerator / denominator : null };
}

/** 기준 장소 다음 방문지 분포: 세션마다 기준 장소 이후 처음 연 다른 장소를 셉니다. */
export function nextPlaceDistribution(
  events: readonly AppEvent[],
  anchorPlaceId: string,
  gapMs: number = SESSION_GAP_MS,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of splitSessions(events, gapMs)) {
    const next = nextPlaceAfter(s, anchorPlaceId);
    if (next) out[next] = (out[next] ?? 0) + 1;
  }
  return out;
}

/** 많이 들은 문장: `phrase_play` 중 phraseId가 있는 것을 횟수 내림차순(같으면 id순)으로 */
export function topPhrases(
  events: readonly AppEvent[],
  limit = 5,
): { phraseId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'phrase_play' && e.phraseId) {
      counts.set(e.phraseId, (counts.get(e.phraseId) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([phraseId, count]) => ({ phraseId, count }))
    .sort((a, b) => b.count - a.count || a.phraseId.localeCompare(b.phraseId))
    .slice(0, limit);
}

/** 종류별 이벤트 수 (내 기기 기록 표시용, F-16a) */
export function countByType(events: readonly AppEvent[]): Record<EventType, number> {
  const out = Object.fromEntries(EVENT_TYPES.map((k) => [k, 0])) as Record<EventType, number>;
  for (const e of events) out[e.type]++;
  return out;
}

/**
 * 화면 키·장소 ID·문장 ID 형식 (데이터 ID: 소문자·숫자·하이픈, 예 `ssd`, `gwc-1`).
 * 한글 문장·인식 원문 같은 자유 문자열이 ID 자리로 저장되는 것을 막습니다.
 */
export const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isValidId(v: unknown): v is string {
  return typeof v === 'string' && ID_PATTERN.test(v);
}

const isSource = (v: unknown): v is PhraseSource => v === 'order' || v === 'phrase';

/**
 * 저장 경계의 정제 함수 (기록·복원 양쪽에서 사용).
 * 종류별 허용 필드만으로 **새 객체**를 만들어 추가 필드(인식 원문 등)를 버립니다.
 * 필수 필드가 틀리거나, 선택 필드가 있는데 형식이 틀리면 이벤트 전체를 버리고 null.
 */
export function toAppEvent(v: unknown): AppEvent | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const e = v as Record<string, unknown>;
  const t = e.t;
  if (typeof t !== 'number' || !Number.isFinite(t)) return null;

  /** 선택 ID: 없으면 {} , 형식이 맞으면 { key: id }, 틀리면 null */
  const optId = <K extends 'placeId' | 'phraseId'>(key: K): Partial<Record<K, string>> | null => {
    const x = e[key];
    if (x === undefined) return {};
    return isValidId(x) ? ({ [key]: x } as Record<K, string>) : null;
  };

  switch (e.type) {
    case 'screen_view':
      return isScreenKey(e.screen) ? { type: 'screen_view', screen: e.screen, t } : null;
    case 'place_view':
      return isValidId(e.placeId) ? { type: 'place_view', placeId: e.placeId, t } : null;
    case 'phrase_play':
    case 'staff_shown':
    case 'practice_done': {
      if (!isSource(e.src)) return null;
      const place = optId('placeId');
      const phrase = optId('phraseId');
      if (!place || !phrase) return null;
      if (e.type !== 'practice_done') return { type: e.type, src: e.src, ...place, ...phrase, t };
      let score: { score?: number } = {};
      if (e.score !== undefined) {
        const n = e.score;
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100) return null;
        score = { score: n };
      }
      return { type: 'practice_done', src: e.src, ...place, ...phrase, ...score, t };
    }
    case 'report_sent': {
      if (!REPORT_KINDS.includes(e.kind as ReportKind)) return null;
      const place = optId('placeId');
      if (!place) return null;
      return { type: 'report_sent', kind: e.kind as ReportKind, ...place, t };
    }
    default:
      return null;
  }
}

/** 저장소에서 읽은 값이 이벤트 모양인지 검사 (`toAppEvent`와 같은 기준) */
export function isAppEvent(v: unknown): v is AppEvent {
  return toAppEvent(v) !== null;
}
