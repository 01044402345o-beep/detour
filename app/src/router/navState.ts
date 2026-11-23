/**
 * 연습(S06)·직원(S08) 화면 입력 상태 계약 (T2.0).
 * `navigate(PATHS.practice, { state: phraseInput('order') })`처럼 router state로 넘깁니다.
 * - src 'order': 현재 주문(store cart)으로 만든 주문 문장
 * - src 'phrase': 문장 모음·장소 문장의 한 문장. phraseId = downtown.json의 실제 문장 ID
 * 검증은 받는 쪽 한 곳(parsePhraseInput)에서만 합니다. phraseInput은 src·ID를 바꾸지 않습니다.
 */
import { isValidId } from '../domain/events';

export type PhraseInputState = { src: 'order' } | { src: 'phrase'; phraseId: string };

export function phraseInput(src: 'order'): PhraseInputState;
export function phraseInput(src: 'phrase', phraseId: string): PhraseInputState;
export function phraseInput(src: 'order' | 'phrase', phraseId?: string): PhraseInputState {
  return src === 'phrase' ? { src, phraseId: phraseId ?? '' } : { src: 'order' };
}

/**
 * location.state를 계약 형식으로 읽습니다. 형식이 틀리거나 'phrase'의 ID가 이용 기록 ID 형식
 * (isValidId: 소문자·숫자·하이픈)이 아니면 null. 문장이 실제 데이터에 있는지는 받는 화면이 확인합니다.
 */
export function parsePhraseInput(state: unknown): PhraseInputState | null {
  if (!state || typeof state !== 'object') return null;
  const { src, phraseId } = state as Record<string, unknown>;
  if (src === 'order') return { src: 'order' };
  if (src === 'phrase' && isValidId(phraseId)) return { src: 'phrase', phraseId };
  return null;
}
