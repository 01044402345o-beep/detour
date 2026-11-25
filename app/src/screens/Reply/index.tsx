/**
 * S09 직원 응답 결과 (T2.5, PRD F-11).
 * 직원이 누른 응답을 손님 언어로 크게 보여줍니다. 한국어 응답은 i18n/staffKo.ts(한국어 고정).
 * - 품절: "주문 수정" → 주문한 장소 상세(S03)의 메뉴 탭
 * - "직원에게 보여주기": 같은 문장으로 직원 화면 다시 열기
 * - 완료: 코스로 (다음 정류장)
 * 입력: router state `ReplyInputState` (parseReplyInput). 틀리면 직원 화면으로 돌려보냅니다.
 * T6.5(DESIGN.md 7장 '응답'): 같은 밝은 바탕·파랑 체계, 이모지 없음. 응답마다 다음 행동 한 줄과
 * 그 행동을 주 버튼(파랑)으로: 네 → 완료(코스) · 품절 → 주문 수정 · 잠시만 → 다시 보여주기 · 계산대 → 완료.
 */
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getPlace } from '../../data';
import { useLang, useT } from '../../i18n';
import { STAFF_KO, STAFF_REPLY_KEYS, type StaffReply } from '../../i18n/staffKo';
import type { PhraseInputState } from '../../router/navState';
import { PATHS, placePath } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { Button, Icon, cx, type ButtonVariant, type IconName } from '../../ui';
import { findPhrase } from '../Staff/staffContent';
import { parseReplyInput } from './replyState';
import './reply.css';

/** 목업 S09 아이콘 (✓ ✕ ⏳ ₩) */
const REPLY_ICON: Record<StaffReply, IconName | null> = {
  yes: 'check',
  sold: 'close',
  wait: 'clock',
  pay: null, // ₩ 글자
};

/** 응답별 다음 행동 안내 (손님 언어) */
const NEXT_KEY = {
  yes: 'reply.yesNext',
  sold: 'reply.soldNext',
  wait: 'reply.waitNext',
  pay: 'reply.payNext',
} as const satisfies Record<StaffReply, string>;

type ActionId = 'edit' | 'again' | 'done';

/** 응답별 버튼 순서: 첫 번째가 주 버튼(파랑 채움), 나머지는 보조 */
function actionOrder(reply: StaffReply, canEdit: boolean): ActionId[] {
  switch (reply) {
    case 'sold':
      return canEdit ? ['edit', 'again', 'done'] : ['again', 'done'];
    case 'wait':
      return ['again', 'done'];
    default:
      return ['done', 'again'];
  }
}

/** 메뉴 탭이 있는(주문 가능한) 장소만 "주문 수정" 대상 */
function editTarget(input: PhraseInputState, currentPlaceId: string | null): string | null {
  const id =
    input.src === 'order' ? currentPlaceId : (findPhrase(input.phraseId)?.place.id ?? null);
  const place = id ? getPlace(id) : undefined;
  return place?.orderable ? place.id : null;
}

export default function ReplyScreen() {
  const t = useT();
  const lang = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPlaceId = useAppStore((s) => s.currentPlaceId);
  const parsed = parseReplyInput(location.state);

  if (!parsed) {
    return <Navigate to={PATHS.staff} replace state={location.state} />;
  }

  const { reply, input } = parsed;
  const keys = STAFF_REPLY_KEYS[reply];
  const icon = REPLY_ICON[reply];
  const editId = reply === 'sold' ? editTarget(input, currentPlaceId) : null;
  const order = actionOrder(reply, editId !== null);

  const actions: Record<ActionId, { label: string; icon?: IconName; onClick: () => void }> = {
    edit: {
      label: t('reply.edit'),
      onClick: () => editId && navigate(placePath(editId), { state: { tab: 'menu' } }),
    },
    again: {
      label: t('reply.backToStaff'),
      icon: 'text',
      onClick: () => navigate(PATHS.staff, { state: input }),
    },
    done: { label: t('common.done'), onClick: () => navigate(PATHS.course) },
  };

  return (
    <section className={cx('screen reply', `reply--${reply}`)} data-testid="screen-reply">
      <div className="reply__main">
        <div className="reply__ic" aria-hidden="true">
          {icon ? <Icon name={icon} size={40} strokeWidth={2.5} /> : '₩'}
        </div>
        <p className="reply__ko" lang="ko" data-testid="reply-ko">
          {STAFF_KO.replyResultPrefix} · {STAFF_KO.replies[reply]}
        </p>
        <h1 className="reply__title" data-testid="reply-title">
          {t(keys.title)}
        </h1>
        <p className="reply__body">{t(keys.body)}</p>
        <p className="reply__next" data-testid="reply-next">
          <Icon name="forward" size={18} />
          <span lang={lang}>{t(NEXT_KEY[reply])}</span>
        </p>
      </div>

      <div className="reply__actions" data-testid="reply-actions">
        {order.map((id, i) => {
          const a = actions[id];
          const variant: ButtonVariant = i === 0 ? 'ink' : 'ghost';
          return (
            <Button
              key={id}
              variant={variant}
              icon={a.icon}
              className={cx(`reply__${id}`, i === 0 && 'reply__primary')}
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
