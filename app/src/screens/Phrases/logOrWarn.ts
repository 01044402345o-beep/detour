import type { AppEventInput } from '../../domain/events';

/**
 * store.logEvent를 호출하고, 기록이 버려지면(false) 개발 모드에서 경고합니다 (task.md 0.2 · T1.6 R2).
 * T2.6 화면(문장 모음·저장)이 같이 씁니다.
 */
export function logOrWarn(logEvent: (e: AppEventInput) => boolean, event: AppEventInput): boolean {
  const ok = logEvent(event);
  if (!ok && import.meta.env.DEV) console.warn('[detour] event dropped', event);
  return ok;
}
