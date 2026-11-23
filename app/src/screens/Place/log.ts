/** store.logEvent가 false(형식 오류로 버림)를 돌려주면 개발 모드에서 경고 (T1.6 R2) */
export function warnIfDropped(logged: boolean, what: string): void {
  if (!logged && import.meta.env.DEV) console.warn(`[log] event dropped: ${what}`);
}
