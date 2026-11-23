/**
 * 직원 응답 화면(S09) 입력 상태 (T2.5, PRD F-11).
 * 직원 화면이 `navigate(PATHS.reply, { state: replyInput('sold', input) })`로 넘기고,
 * 응답 화면이 parseReplyInput 한 곳에서 검증합니다. input은 "직원에게 보여주기"로 돌아갈 때
 * 같은 문장을 다시 열기 위해 함께 넘깁니다.
 */
import { parsePhraseInput, type PhraseInputState } from '../../router/navState';
import type { StaffReply } from '../../i18n/staffKo';

export type ReplyInputState = { reply: StaffReply; input: PhraseInputState };

/** 응답 버튼 순서 (PRD F-11: 네 · 품절이에요 · 잠시만요 · 계산대에서 결제해 주세요) */
export const REPLY_ORDER: readonly StaffReply[] = ['yes', 'sold', 'wait', 'pay'];

export function isStaffReply(v: unknown): v is StaffReply {
  return REPLY_ORDER.includes(v as StaffReply);
}

export function replyInput(reply: StaffReply, input: PhraseInputState): ReplyInputState {
  return { reply, input };
}

/**
 * location.state → 응답 입력. 응답 종류가 틀리면 null.
 * 함께 온 문장 입력이 틀리면 현재 주문(`{ src: 'order' }`)으로 대신합니다.
 */
export function parseReplyInput(state: unknown): ReplyInputState | null {
  if (!state || typeof state !== 'object') return null;
  const { reply, input } = state as Record<string, unknown>;
  if (!isStaffReply(reply)) return null;
  return { reply, input: parsePhraseInput(input) ?? { src: 'order' } };
}
