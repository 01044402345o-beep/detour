/**
 * S09 직원 응답 결과 (T2.5, PRD F-11).
 * 직원이 누른 응답을 손님 언어로 크게 보여줍니다. 한국어 응답은 i18n/staffKo.ts(한국어 고정).
 * - 품절: "주문 수정" → 주문한 장소 상세(S03)의 메뉴 탭
 * - "직원에게 보여주기": 같은 문장으로 직원 화면 다시 열기
 * - 완료: 코스로 (다음 정류장)
 * 입력: router state `ReplyInputState` (parseReplyInput). 틀리면 직원 화면으로 돌려보냅니다.
 */
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getPlace } from '../../data';
import { useT } from '../../i18n';
import { STAFF_KO, STAFF_REPLY_KEYS, type StaffReply } from '../../i18n/staffKo';
import type { PhraseInputState } from '../../router/navState';
import { PATHS, placePath } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { Button, Icon, cx, type IconName } from '../../ui';
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

/** 메뉴 탭이 있는(주문 가능한) 장소만 "주문 수정" 대상 */
function editTarget(input: PhraseInputState, currentPlaceId: string | null): string | null {
  const id =
    input.src === 'order' ? currentPlaceId : (findPhrase(input.phraseId)?.place.id ?? null);
  const place = id ? getPlace(id) : undefined;
  return place?.orderable ? place.id : null;
}

export default function ReplyScreen() {
  const t = useT();
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

  return (
    <section className={cx('screen reply', `reply--${reply}`)} data-testid="screen-reply">
      <div className="reply__ic" aria-hidden="true">
        {icon ? <Icon name={icon} size={44} strokeWidth={2.5} /> : '₩'}
      </div>
      <p className="reply__ko" lang="ko" data-testid="reply-ko">
        {STAFF_KO.replyResultPrefix} · {STAFF_KO.replies[reply]}
      </p>
      <h1 className="reply__title" data-testid="reply-title">
        {t(keys.title)}
      </h1>
      <p className="reply__body">{t(keys.body)}</p>

      <div className="reply__actions">
        {editId && (
          <Button
            className="reply__edit"
            onClick={() => navigate(placePath(editId), { state: { tab: 'menu' } })}
          >
            {t('reply.edit')}
          </Button>
        )}
        <Button className="reply__again" onClick={() => navigate(PATHS.staff, { state: input })}>
          {t('reply.backToStaff')}
        </Button>
        <Button className="reply__done" onClick={() => navigate(PATHS.course)}>
          {t('common.done')}
        </Button>
      </div>
    </section>
  );
}
