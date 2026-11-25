/**
 * 앱을 열 때마다 인트로 (사용자 요청 '인트로가 항상 나오도록' 2026-11-26, coordinator 구현 범위, T6.8).
 * - 언어 미선택이면 이와 별개로 어느 주소든 인트로 → 홈(LangGate 기존 규칙).
 * - PWA 창 재개·뒤로가기 캐시(BFCache) 복원은 모듈을 다시 불러오지 않으므로 다시 나오지 않습니다.
 * - 페이지를 새로 불러온 뒤 **처음 그리는 화면이 홈**이면, 언어를 이미 골랐어도 인트로(/lang)를 먼저 보여 줍니다.
 * - 특정 화면 주소(#/course, #/place/… 등)로 바로 열거나 새로고침하면 그 화면을 그대로 엽니다(링크·새로고침 보존).
 * - 한 번 판단하면(어느 화면이든 첫 화면이 그려지면) 같은 페이지 안에서는 다시 끼어들지 않습니다.
 * 값은 페이지(모듈)를 불러올 때 true로 시작합니다. 테스트는 setLaunchIntroPending으로 정합니다.
 */
let pending = true;

export function isLaunchIntroPending(): boolean {
  return pending;
}

/** 첫 화면이 그려진 뒤 호출 (StrictMode에서 두 번 불려도 결과 같음) */
export function settleLaunchIntro(): void {
  pending = false;
}

/** 테스트 전용 */
export function setLaunchIntroPending(value: boolean): void {
  pending = value;
}
