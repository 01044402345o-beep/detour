/**
 * S08 직원에게 보여주기 (T2.5, PRD F-10·F-11).
 * - 한국어 안내·응답 버튼은 i18n/staffKo.ts(한국어 고정), 손님 언어 문구는 사전(t()).
 * - 입력: router state `PhraseInputState` (parsePhraseInput). 없거나 틀리면 현재 주문.
 * - staff_shown은 표시할 내용이 있을 때 location.key당 1회 기록합니다.
 * - 화면 켜짐 유지: Screen Wake Lock (미지원 시 무시).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pickL10n, useLang, useT } from '../../i18n';
import { STAFF_KO, STAFF_REPLY_KEYS, type StaffReply } from '../../i18n/staffKo';
import { phraseInput, parsePhraseInput, type PhraseInputState } from '../../router/navState';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { Button, Icon, IconButton, ListenButton, cx } from '../../ui';
import { REPLY_ORDER, replyInput } from '../Reply/replyState';
import { resolveStaffContent, staffFontSize, staffKo, type StaffContent } from './staffContent';
import { useWakeLock } from './useWakeLock';
import './staff.css';

/** 응답 버튼 아래 작은 손님 언어 문구: 제목에서 이모지를 뺀 것 (목업과 같이 'Yes! 👍' → 'Yes!') */
function plainTitle(s: string): string {
  return s.replace(/\s*\p{Extended_Pictographic}️?/gu, '').trim();
}

/** 앱 안에서 쌓인 이전 화면이 있는지 (TopBar와 같은 기준) */
function hasInAppHistory(): boolean {
  const state = window.history.state as { idx?: unknown } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

/** 이 화면이 보여주는 내용을 다시 열 입력 상태 */
function inputFor(content: StaffContent): PhraseInputState {
  return content.kind === 'order' ? phraseInput('order') : phraseInput('phrase', content.phrase.id);
}

function warnDev(ok: boolean, what: string) {
  if (!ok && import.meta.env.DEV) console.warn(`[staff] logEvent rejected: ${what}`);
}

export default function StaffScreen() {
  const t = useT();
  const lang = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useAppStore((s) => s.cart);
  const currentPlaceId = useAppStore((s) => s.currentPlaceId);
  const takeout = useAppStore((s) => s.takeout);
  const logEvent = useAppStore((s) => s.logEvent);
  const [big, setBig] = useState(false);

  const content = useMemo(
    () => resolveStaffContent(parsePhraseInput(location.state), { cart, currentPlaceId, takeout }),
    [location.state, cart, currentPlaceId, takeout],
  );

  useWakeLock(content !== null);

  // staff_shown: 실제 데이터 ID로 location.key당 1회
  const src = content?.kind;
  const placeId = content?.place.id;
  const phraseId = content?.kind === 'phrase' ? content.phrase.id : undefined;
  const loggedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!src || !placeId || loggedKey.current === location.key) return;
    loggedKey.current = location.key;
    warnDev(
      logEvent({ type: 'staff_shown', src, placeId, ...(phraseId ? { phraseId } : {}) }),
      'staff_shown',
    );
  }, [location.key, src, placeId, phraseId, logEvent]);

  const close = () => {
    if (hasInAppHistory()) navigate(-1);
    else navigate(content?.kind === 'phrase' ? PATHS.phrases : PATHS.order, { replace: true });
  };

  const header = (
    <header className="ui-topbar">
      <div className="ui-topbar__side">
        <IconButton icon="close" label={t('common.close')} onClick={close} />
      </div>
      <h1 className="ui-topbar__title staff__title">{t('order.showStaff')}</h1>
      <div className="ui-topbar__side" />
    </header>
  );

  if (!content) {
    return (
      <section className="screen staff" data-testid="screen-staff">
        {header}
        <div className="staff__empty">
          <p className="staff__empty-title">{t('order.empty')}</p>
          <p className="staff__empty-hint">{t('order.emptyHint')}</p>
          <Button variant="ink" onClick={() => navigate(PATHS.course)}>
            {t('nav.course')}
          </Button>
        </div>
      </section>
    );
  }

  const ko = staffKo(content);
  const meaning = pickL10n(
    lang,
    content.kind === 'order' ? content.sentence.meaning : content.phrase.meaning,
  );
  const onReply = (reply: StaffReply) =>
    navigate(PATHS.reply, { state: replyInput(reply, inputFor(content)) });
  const onPlay = () =>
    warnDev(
      logEvent({
        type: 'phrase_play',
        src: content.kind,
        placeId: content.place.id,
        ...(content.kind === 'phrase' ? { phraseId: content.phrase.id } : {}),
      }),
      'phrase_play',
    );

  return (
    <section className="screen staff" data-testid="screen-staff">
      {header}
      <p className="staff__note" lang="ko" data-testid="staff-note">
        👋 {content.kind === 'order' ? STAFF_KO.noteOrder : STAFF_KO.noteRequest}
      </p>

      <div className="staff__big">
        <p
          className="staff__ko"
          lang="ko"
          style={{ fontSize: staffFontSize(ko, big) }}
          data-testid="staff-sentence"
        >
          {ko}
        </p>
        {content.kind === 'order' && (
          <div>
            <ul className="staff__lines" lang="ko" data-testid="staff-lines">
              {content.lines.map(({ item, qty }) => (
                <li key={item.id}>
                  · {item.ko}{' '}
                  <b className="staff__qty">
                    {qty}
                    {item.counter}
                  </b>
                </li>
              ))}
              {content.takeout && <li data-testid="staff-takeout">· {STAFF_KO.takeoutLine}</li>}
            </ul>
          </div>
        )}
        <hr className="staff__rule" />
        <p className="staff__meaning">{meaning}</p>
      </div>

      <p className="staff__prompt">
        <span lang="ko">{STAFF_KO.replyPrompt}</span> · {t('staff.staffReply')}
      </p>
      <div className="staff__replies">
        {REPLY_ORDER.map((r) => (
          <button
            key={r}
            type="button"
            className={cx('staff__reply', r === 'yes' && 'staff__reply--yes')}
            data-reply={r}
            onClick={() => onReply(r)}
          >
            <span lang="ko">{STAFF_KO.replies[r]}</span>
            <small>{plainTitle(t(STAFF_REPLY_KEYS[r].title))}</small>
          </button>
        ))}
      </div>

      <div className="staff__ctrls">
        <ListenButton variant="pill" text={ko} label={t('staff.play')} onPlay={onPlay}>
          <Icon name="speaker" size={16} />
          {t('staff.play')}
        </ListenButton>
        <button
          type="button"
          className="staff__toggle"
          aria-pressed={big}
          onClick={() => setBig((b) => !b)}
        >
          <Icon name="text" size={16} />
          {t('staff.bigger')}
        </button>
      </div>
    </section>
  );
}
