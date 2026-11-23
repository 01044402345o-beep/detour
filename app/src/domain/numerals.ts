/**
 * 한국어 수사 (공유 계약 시그니처, 구현은 T1.3).
 * 입력 범위: 1~9 정수 (PRD F-06 수량 제한).
 */

/** 고유어 수사(관형형): 1→한, 2→두, 3→세 … 9→아홉. 개·공기 단위에 사용 */
export function toNative(n: number): string {
  void n;
  throw new Error('T1.3');
}

/** 한자어 수사: 1→일, 2→이 … 9→구. 인분 읽기에 사용 */
export function toSino(n: number): string {
  void n;
  throw new Error('T1.3');
}
