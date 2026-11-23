/**
 * 공유 계약 타입 (T0.2). PRD v0.3 8.1 데이터 모델 + 모듈 간 계약.
 * 바꾸면 이 타입에 의존하는 task(T1.x·T2.x)에 영향이 있습니다.
 */

// ───────── PRD 8.1 데이터 모델 ─────────

/** 사용자 언어 */
export type Lang = 'en' | 'ja' | 'zh';

export const LANGS: readonly Lang[] = ['en', 'ja', 'zh'];

/** 3개 언어 문자열 */
export type L10n = { en: string; ja: string; zh: string };

/** 확인일 'YYYY-MM-DD' */
export type IsoDate = `${number}-${number}-${number}`;

export type PlaceCategory = 'food' | 'sight';

/** 수량 단위. 개·공기 → 고유어 수사, 인분 → 한자어 수사 (PRD F-06) */
export type Counter = '개' | '인분' | '공기';

export type AllergenStatus = 'confirmed' | 'unknown';

export type GeoPoint = { lat: number; lng: number };

export type MenuItem = {
  id: string;
  ko: string;
  name: L10n;
  roman: string;
  kana: string;
  counter: Counter;
  /** 없으면 가격 미확인 → '가격 확인 필요' 표시 (F-04·F-05) */
  priceKrw?: number;
  /** 메뉴 한 줄 설명 (목업 S03 메뉴 카드) */
  description?: L10n;
  signature?: boolean;
  spicy?: boolean;
  verified: boolean;
  allergens?: L10n;
  allergenStatus: AllergenStatus;
};

/** 문장의 단어 칩 */
export type PhraseWord = { ko: string; meaning: L10n };

export type Phrase = {
  id: string;
  ko: string;
  roman: string;
  kana: string;
  meaning: L10n;
  words: PhraseWord[];
};

export type Place = {
  id: string;
  order: number;
  category: PlaceCategory;
  nameKo: string;
  name: L10n;
  /** 한국어 동·지역 이름 (예: 은행동) */
  area: string;
  /** 사용자 언어로 된 동·지역 이름 (목업 S02·S03 부제) */
  areaLocal: L10n;
  hours: string;
  closedOn?: string;
  checkedAt: IsoDate;
  walkMinFromPrev: number;
  transitHint: L10n;
  orderable: boolean;
  takeout: boolean;
  steps: L10n[];
  allergens?: L10n;
  menu?: MenuItem[];
  phrases: Phrase[];
  geo: GeoPoint;
};

export type Course = {
  id: string;
  hub: 'downtown';
  title: L10n;
  /** Place.id 목록 (방문 순서) */
  stops: string[];
  distanceKm: number;
  durationMin: number;
};

// ───────── 공유 계약: 주문 문장 (T1.3) ─────────

/** 주문 문장의 단어 칩 하나. 칩을 누르면 ko만 읽습니다 (F-07). */
export type OrderWord = {
  ko: string;
  roman: string;
  kana: string;
  meaning: L10n;
};

/** 주문 문장 생성 결과. 빈 주문이면 생성 함수가 null을 반환합니다. */
export type OrderSentence = {
  ko: string;
  roman: string;
  kana: string;
  meaning: L10n;
  words: OrderWord[];
};

// ───────── 공유 계약: 채점 (T1.4) ─────────

/** 목표 단어별 일치 결과 */
export type WordMatch = {
  /** 목표 단어 */
  ko: string;
  /** 정렬된 인식 단어 (대응 단어가 없으면 null) */
  heard: string | null;
  matched: boolean;
  /** 단어 단위 인식 일치도 0~100 */
  score: number;
};

/** 인식 결과가 비면 0점 대신 status:'empty' (F-09) */
export type ScoreResult =
  | { status: 'empty' }
  | {
      status: 'scored';
      /** '인식 일치도' 0~100 */
      score: number;
      words: WordMatch[];
      /** 가장 약한 단어의 words 인덱스 (모두 일치면 null) */
      weakestIndex: number | null;
    };

// ───────── 공유 계약: 음성 (T1.5) ─────────

export type TtsState = 'unsupported' | 'no-korean-voice' | 'ready';

export type SttFailureReason = 'denied' | 'no-speech' | 'timeout' | 'network' | 'aborted' | 'error';

/** 실패 상태(SttFailureReason)에서 UI에 넘기는 두 선택지 */
export type SttFailureActions = { retry: () => void; showStaff: () => void };

/** 미지원 상태의 선택지. 미지원은 재시도 없음(PRD F-08) — 직원에게 보여주기만 */
export type SttUnsupportedActions = Pick<SttFailureActions, 'showStaff'>;

/** PRD F-08 / task.md T1.5 상태 머신 */
export type SttState =
  | { status: 'unsupported'; actions: SttUnsupportedActions }
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'listening' }
  | { status: 'processing' }
  | { status: 'result'; transcript: string }
  | { status: SttFailureReason; actions: SttFailureActions };
