/**
 * 한국어 수사 (공유 계약 시그니처 T0.2, 구현 T1.3).
 * 입력 범위: 1~9 정수 (PRD F-06 수량 제한). 범위 밖이면 RangeError.
 * 표기 기준: task.md T1.3 수사 검수표. 로마자·가타카나는 완성 구절의 발음(연음 반영),
 * 된소리는 로마자 규정대로 표기하지 않음. 가타카나는 근사 표기(T4.2 원어민 검수 대상).
 */
import type { Counter, L10n } from '../types';

export const QTY_MIN = 1;
export const QTY_MAX = 9;

/** 1~9 정수인지 */
export function isValidQty(n: number): boolean {
  return Number.isInteger(n) && n >= QTY_MIN && n <= QTY_MAX;
}

function assertQty(n: number): void {
  if (!isValidQty(n)) {
    throw new RangeError(`수량은 ${QTY_MIN}~${QTY_MAX} 정수여야 합니다: ${n}`);
  }
}

// 인덱스 0은 비움 (1~9만 사용)
const NATIVE = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'] as const;
const NATIVE_ROMAN = [
  '',
  'han',
  'du',
  'se',
  'ne',
  'daseot',
  'yeoseot',
  'ilgop',
  'yeodeol',
  'ahop',
] as const;
const NATIVE_KANA = [
  '',
  'ハン',
  'トゥ',
  'セ',
  'ネ',
  'タソッ',
  'ヨソッ',
  'イルゴプ',
  'ヨドル',
  'アホプ',
] as const;

const SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'] as const;

/** n인분 완성 구절 발음 (연음 반영: 1인분 → 이린분) */
const INBUN_ROMAN = [
  '',
  'irinbun',
  'i-inbun',
  'saminbun',
  'sa-inbun',
  'o-inbun',
  'yuginbun',
  'chirinbun',
  'parinbun',
  'gu-inbun',
] as const;
const INBUN_KANA = [
  '',
  'イリンブン',
  'イインブン',
  'サミンブン',
  'サインブン',
  'オインブン',
  'ユギンブン',
  'チリンブン',
  'パリンブン',
  'クインブン',
] as const;

/** 고유어 수사(관형형): 1→한, 2→두, 3→세 … 9→아홉. 개·공기 단위에 사용 */
export function toNative(n: number): string {
  assertQty(n);
  return NATIVE[n];
}

/** 한자어 수사: 1→일, 2→이 … 9→구. 인분 읽기에 사용 */
export function toSino(n: number): string {
  assertQty(n);
  return SINO[n];
}

/** 수량 구절 (수사 + 단위) */
export type QuantityPhrase = { ko: string; roman: string; kana: string };

const COUNTER_READING: Record<Exclude<Counter, '인분'>, { roman: string; kana: string }> = {
  개: { roman: 'gae', kana: 'ゲ' },
  공기: { roman: 'gonggi', kana: 'コンギ' },
};

/**
 * 수량 구절. 개·공기 → "두 개"(고유어 + 띄어쓰기), 인분 → "2인분"(아라비아 숫자, 읽기는 한자어).
 * 수사 검수표 27칸과 같은 값을 냅니다.
 */
export function quantityPhrase(n: number, counter: Counter): QuantityPhrase {
  assertQty(n);
  if (counter === '인분') {
    return { ko: `${n}인분`, roman: INBUN_ROMAN[n], kana: INBUN_KANA[n] };
  }
  const reading = COUNTER_READING[counter];
  return {
    ko: `${NATIVE[n]} ${counter}`,
    roman: `${NATIVE_ROMAN[n]} ${reading.roman}`,
    kana: `${NATIVE_KANA[n]} ${reading.kana}`,
  };
}

/**
 * 수량 칩의 사용자 언어 뜻 (T1.3 R1-01). 인분 → servings/人前/人份, 공기 → bowl(s)/杯/碗,
 * 개 → 메뉴마다 맞는 단위어가 달라 `× n` 유지. 문장 전체 번역(×n)에는 쓰지 않습니다(목업 기준).
 * ja 杯·zh 碗·人前·人份은 근사 번역 — T4.2 원어민 검수 대상.
 */
export function quantityMeaning(n: number, counter: Counter): L10n {
  assertQty(n);
  switch (counter) {
    case '인분':
      return { en: n === 1 ? '1 serving' : `${n} servings`, ja: `${n}人前`, zh: `${n}人份` };
    case '공기':
      return { en: n === 1 ? '1 bowl' : `${n} bowls`, ja: `${n}杯`, zh: `${n}碗` };
    case '개': {
      const times = `× ${n}`;
      return { en: times, ja: times, zh: times };
    }
  }
}
