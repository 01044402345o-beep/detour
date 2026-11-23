/** 페이지 ↔ 서비스 워커 메시지 (T3.1). 양쪽이 같은 값을 쓰도록 한 곳에 둡니다. */

/** workbox-window의 messageSkipWaiting()이 보내는 값과 같습니다 */
export const MSG_SKIP_WAITING = 'SKIP_WAITING';
export const MSG_PRECACHE_STATUS = 'DETOUR_PRECACHE_STATUS';

export type PrecacheStatus = { total: number; cached: number };

/** "오프라인 준비 완료" 조건: 프리캐시 목록이 비어 있지 않고 전부 캐시됨 */
export function isPrecacheComplete(s: PrecacheStatus | null | undefined): boolean {
  return !!s && s.total > 0 && s.cached === s.total;
}
