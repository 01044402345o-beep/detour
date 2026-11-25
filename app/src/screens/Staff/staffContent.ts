/**
 * 직원 화면(S08) 표시 내용 계산 (T2.5, PRD F-10).
 * - src 'order': store의 현재 주문(cart·currentPlaceId·takeout)으로 주문 문장을 만듭니다.
 * - src 'phrase': downtown.json에서 문장 ID를 찾아 그 문장만 보여줍니다(주문 목록 없음).
 * - 입력이 없거나(직접 진입·새로고침) 문장 ID가 데이터에 없으면 현재 주문으로 대신합니다.
 *   현재 주문도 비어 있으면 null → 화면이 빈 주문 안내를 보여줍니다.
 */
import { getPlace, places, type ContentPlace } from '../../data';
import { buildOrderSentence, toOrderLines, type OrderLine } from '../../domain/orderSentence';
import type { PhraseInputState } from '../../router/navState';
import { effectiveTakeout, type Cart } from '../../store/useAppStore';
import type { OrderSentence, Phrase } from '../../types';

export type StaffContent =
  | {
      kind: 'order';
      place: ContentPlace;
      sentence: OrderSentence;
      lines: OrderLine[];
      /** 문장 생성에 쓴 포장 여부 (effectiveTakeout) */
      takeout: boolean;
    }
  | { kind: 'phrase'; place: ContentPlace; phrase: Phrase };

export type OrderSnapshot = { cart: Cart; currentPlaceId: string | null; takeout: boolean };

/** 문장 ID → 문장과 그 문장이 속한 장소 (없으면 null) */
export function findPhrase(phraseId: string): { place: ContentPlace; phrase: Phrase } | null {
  for (const place of places) {
    const phrase = place.phrases.find((p) => p.id === phraseId);
    if (phrase) return { place, phrase };
  }
  return null;
}

/** 현재 주문으로 만든 직원 화면 내용 (빈 주문·메뉴 없는 장소면 null) */
export function orderContent(order: OrderSnapshot): StaffContent | null {
  const place = order.currentPlaceId ? getPlace(order.currentPlaceId) : undefined;
  if (!place?.menu) return null;
  const lines = toOrderLines(place.menu, order.cart[place.id] ?? {});
  const takeout = effectiveTakeout(order.takeout, place);
  let sentence: OrderSentence | null;
  try {
    sentence = buildOrderSentence(lines, takeout);
  } catch {
    sentence = null; // 손상된 수량 — store가 막지만 화면은 깨지지 않게
  }
  return sentence ? { kind: 'order', place, sentence, lines, takeout } : null;
}

export function resolveStaffContent(
  input: PhraseInputState | null,
  order: OrderSnapshot,
): StaffContent | null {
  if (input?.src === 'phrase') {
    const found = findPhrase(input.phraseId);
    if (found) return { kind: 'phrase', ...found };
  }
  return orderContent(order);
}

/** 화면에 크게 보일 한국어 문장 */
export function staffKo(content: StaffContent): string {
  return content.kind === 'order' ? content.sentence.ko : content.phrase.ko;
}

/** 글자 크기 단계 (A− / A+): 56 · 64 · 72px (DESIGN.md 3장 직원 화면 56~72px) */
export const STAFF_SIZES = [56, 64, 72] as const;
export const STAFF_SIZE_LEVELS = STAFF_SIZES.length;
/** 이 글자 수 이하인 짧은 문장은 기본 64px, 그보다 긴 문장(여러 메뉴 등)은 기본 56px */
export const STAFF_SHORT_MAX = 14;

/** 문장 길이에 따른 처음 단계 (긴 문장도 56px 아래로 내리지 않고 세로 스크롤로 대응, T6.5 R1 M-01) */
export function staffDefaultLevel(ko: string): number {
  return ko.length <= STAFF_SHORT_MAX ? 1 : 0;
}

/** 큰 문장 글자 크기(px). level을 생략하면 문장 길이에 따른 처음 단계, 범위 밖은 끝 단계로 */
export function staffFontSize(ko: string, level: number = staffDefaultLevel(ko)): number {
  const i = Math.min(Math.max(Math.round(level), 0), STAFF_SIZE_LEVELS - 1);
  return STAFF_SIZES[i];
}

/**
 * 가장 긴 낱말의 폭(em) — 큰 문장이 낱말 중간에서 끊기지 않게 글자 크기 상한을 줄 폭에 맞추는 데 씀
 * (T6.7 M-04). 낱말은 일반 공백으로만 나눔(줄바꿈 없는 공백 U+00A0으로 붙인 "한 개"는 한 덩어리).
 * 글자 폭은 굵기 700·자간 -0.035em 기준 실측(Pretendard 한글 0.83em)에 대체 글꼴(맑은 고딕 등)
 * 여유를 더한 보수적인 값입니다.
 */
export const STAFF_WIDE_EM = 0.9; // 한글·한자·가나
export const STAFF_NARROW_EM = 0.7; // 라틴 글자·숫자·₩
export const STAFF_PUNCT_EM = 0.5; // 그 밖(문장부호·공백류)

function charEm(c: string): number {
  if (/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(c))
    return STAFF_WIDE_EM;
  if (/[0-9A-Za-z\p{Sc}]/u.test(c)) return STAFF_NARROW_EM; // ₩ 등 통화 기호 포함
  return STAFF_PUNCT_EM;
}

export function staffLongestWordEm(text: string): number {
  const words = text.split(/[ \t\r\n]+/);
  const em = Math.max(0, ...words.map((w) => [...w].reduce((sum, c) => sum + charEm(c), 0)));
  return Math.round(em * 100) / 100;
}

/**
 * 큰 문장의 실제 표시 크기(px) (T6.7 R1 M-01, DESIGN.md 3장):
 * 단계 크기(56·64·72)를 쓰되 가장 긴 낱말(wordEm)이 줄 폭(lineWidth)에 한 줄로 들어가는 크기를
 * 넘지 않게 합니다. 다만 56px 하한이 우선이라 그 아래로는 내리지 않습니다 — 한 낱말이 56px로도
 * 줄보다 길면 그 낱말 안에서만 줄이 바뀝니다(staff.css overflow-wrap: anywhere, 넘칠 때만).
 * lineWidth를 모르면(첫 그리기 전·테스트 환경) 단계 크기 그대로.
 */
export function staffDisplaySize(
  ko: string,
  level: number,
  wordEm: number,
  lineWidth: number | null,
): number {
  const step = staffFontSize(ko, level);
  if (!lineWidth || lineWidth <= 0 || wordEm <= 0) return step;
  const fit = Math.floor((lineWidth / wordEm) * 10) / 10;
  return Math.max(STAFF_SIZES[0], Math.min(step, fit));
}

export interface StaffSizeState {
  /** 지금 표시 크기(px) */
  px: number;
  /** A+를 누르면 갈 단계: 표시 크기가 실제로 커지는 가장 가까운 위 단계. 없으면 null(버튼 비활성) */
  bigger: number | null;
  /** A−를 누르면 갈 단계: 표시 크기가 실제로 작아지는 가장 가까운 아래 단계. 없으면 null(버튼 비활성) */
  smaller: number | null;
}

export function staffSizeControls(
  ko: string,
  level: number,
  wordEm: number,
  lineWidth: number | null,
): StaffSizeState {
  const cur = Math.min(Math.max(Math.round(level), 0), STAFF_SIZE_LEVELS - 1);
  const at = (l: number) => staffDisplaySize(ko, l, wordEm, lineWidth);
  const px = at(cur);
  let bigger: number | null = null;
  for (let l = cur + 1; l < STAFF_SIZE_LEVELS && bigger === null; l++) if (at(l) > px) bigger = l;
  let smaller: number | null = null;
  for (let l = cur - 1; l >= 0 && smaller === null; l--) if (at(l) < px) smaller = l;
  return { px, bigger, smaller };
}

/**
 * 화면 표시용: 수량 단위(개·인분·공기) 앞 띄어쓰기를 줄바꿈 없는 공백으로 바꿔
 * "한 / 개"처럼 수와 단위가 갈라지지 않게 합니다. 읽어주기(TTS)·기록에는 원문 ko를 씁니다.
 */
export function keepCountersTogether(ko: string, lines: readonly OrderLine[]): string {
  const counters = [...new Set(lines.map((l) => l.item.counter))];
  return counters.reduce((s, c) => s.split(` ${c}`).join(`\u00a0${c}`), ko);
}
