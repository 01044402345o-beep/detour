/**
 * "Start walking"이 열 다음 정류장 (PRD F-03 '첫(다음) 정류장').
 * 이용 기록에서 코스 정류장의 마지막 place_view를 찾아 그 다음 정류장을 고릅니다.
 * - 기록 없음 → 첫 정류장
 * - 마지막으로 본 정류장이 k번 → k+1번
 * - 마지막 정류장을 봤으면 → 마지막 정류장 그대로 (코스 끝)
 */
import type { AppEvent } from '../../domain/events';

export function nextStopIndex(stops: readonly string[], events: readonly AppEvent[]): number {
  if (stops.length === 0) return -1;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e.type !== 'place_view') continue;
    const k = stops.indexOf(e.placeId);
    if (k >= 0) return Math.min(k + 1, stops.length - 1);
  }
  return 0;
}
