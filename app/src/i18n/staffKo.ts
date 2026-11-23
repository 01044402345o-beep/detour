import type { MessageKey } from './index';

/**
 * 직원 화면 한국어 고정 문구 (PRD 1.3: 직원 화면의 한국어 안내·응답 버튼은 한국어 고정, F-10·F-11).
 * 언어를 바꿔도 바뀌지 않으며, 하드코딩 검사 예외 목록(hardcodeCheck.ts)에 들어 있습니다.
 * 응답 버튼 아래의 손님 언어 표시는 사전의 reply.* 키를 씁니다.
 */
export const STAFF_KO = {
  /** 주문 카드에서 연 경우 (F-10) */
  noteOrder: '직원분께: 외국인 손님의 주문입니다',
  /** 일반 문장에서 연 경우 (F-10) */
  noteRequest: '직원분께: 외국인 손님의 요청입니다',
  /** 응답 버튼 위 안내 */
  replyPrompt: '직원분 응답',
  /** 응답 결과 화면의 한국어 머리말 */
  replyResultPrefix: '직원 응답',
  /** 직원 응답 버튼 (F-11) */
  replies: {
    yes: '네',
    sold: '품절이에요',
    wait: '잠시만요',
    pay: '계산대에서 결제해 주세요',
  },
} as const;

export type StaffReply = keyof typeof STAFF_KO.replies;

/** 응답 버튼 → 손님 언어 사전 키 */
export const STAFF_REPLY_KEYS = {
  yes: { title: 'reply.yesTitle', body: 'reply.yesBody' },
  sold: { title: 'reply.soldTitle', body: 'reply.soldBody' },
  wait: { title: 'reply.waitTitle', body: 'reply.waitBody' },
  pay: { title: 'reply.payTitle', body: 'reply.payBody' },
} as const satisfies Record<StaffReply, { title: MessageKey; body: MessageKey }>;
