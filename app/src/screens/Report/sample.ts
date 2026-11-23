/**
 * S13 운영자 리포트 예시 데이터 (PRD F-16, 목업 renderReport 값). 시연용이며 실제 기록이 아닙니다.
 * 한국어 이름은 여기 두지 않고 장소·문장 ID로 data JSON에서, 코스 밖 항목은 OPERATOR_KO 키로 찾습니다.
 */
import type { OperatorKoKey } from '../../i18n/operatorKo';
import type { Lang } from '../../types';

export const SAMPLE_PERIOD = '2026.11.01 – 11.21';

export const SAMPLE_KPI = {
  users: 1284,
  usersDeltaPct: 18,
  extraVisitPct: 46,
  orderCards: 612,
  reports: 12,
  reportsPending: 3,
} as const;

/** 성심당 다음 방문지 (%) — placeId(코스 정류장) 또는 코스 밖 항목(OPERATOR_KO 키) */
export type SampleNext =
  | { placeId: string; pct: number; color: string }
  | { labelKey: OperatorKoKey; pct: number; color: string };

export const SAMPLE_NEXT: readonly SampleNext[] = [
  { placeId: 'eun', pct: 38, color: 'var(--plum)' },
  { placeId: 'mus', pct: 21, color: '#8c74d8' },
  { placeId: 'gwc', pct: 17, color: 'var(--acc)' },
  { labelKey: 'nextMarket', pct: 9, color: 'var(--sun)' },
  { labelKey: 'nextHome', pct: 15, color: 'var(--mute)' },
];

/** 많이 쓴 문장 Top 5 — 문장 ID(downtown.json) */
export const SAMPLE_TOP: readonly { phraseId: string; count: number }[] = [
  { phraseId: 'ssd-2', count: 412 },
  { phraseId: 'ssd-1', count: 366 },
  { phraseId: 'ssd-3', count: 214 },
  { phraseId: 'gwc-2', count: 158 },
  { phraseId: 'eun-2', count: 131 },
];

export const SAMPLE_LANG: readonly { lang: Lang; pct: number; color: string }[] = [
  { lang: 'en', pct: 52, color: 'var(--ink)' },
  { lang: 'ja', pct: 21, color: 'var(--acc)' },
  { lang: 'zh', pct: 27, color: 'var(--sea)' },
];

export const SAMPLE_OVERNIGHT_PCT = 7;

export const SAMPLE_HOURS: readonly { h: number; v: number }[] = [
  { h: 10, v: 30 },
  { h: 12, v: 62 },
  { h: 14, v: 88 },
  { h: 16, v: 70 },
  { h: 18, v: 52 },
  { h: 20, v: 34 },
];
