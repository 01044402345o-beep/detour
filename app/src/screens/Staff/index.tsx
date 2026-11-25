/**
 * S08 직원에게 보여주기 (T2.5, PRD F-10·F-11).
 * - 한국어 안내·응답 버튼은 i18n/staffKo.ts(한국어 고정), 손님 언어 문구는 사전(t()).
 * - 입력: router state `PhraseInputState` (parsePhraseInput). 없거나 틀리면 현재 주문.
 * - staff_shown은 표시할 내용이 있을 때 location.key당 1회 기록합니다.
 * - 화면 켜짐 유지: Screen Wake Lock (미지원 시 무시).
 * T6.5(DESIGN.md 7장 '직원'): 짙은 파랑 띠(닫기 · 글자 크기 A−/A+) → 흰 면에 한국어 안내 +
 * 아주 큰 한국어 문장 → 메뉴 요약 줄 → 소리 재생(연파랑) → 응답 버튼(네 = 파랑 채움, 나머지 테두리).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pickL10n, useLang, useT } from '../../i18n';
import { STAFF_KO, STAFF_REPLY_KEYS, type StaffReply } from '../../i18n/staffKo';
import { phraseInput, parsePhraseInput, type PhraseInputState } from '../../router/navState';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { Button, Icon, ListenButton, cx } from '../../ui';
import { formatKrw, orderTotal } from '../Order/orderMath';
import { REPLY_ORDER, replyInput } from '../Reply/replyState';
import {
  keepCountersTogether,
  resolveStaffContent,
  staffDefaultLevel,
  staffKo,
  staffLongestWordEm,
  staffSizeControls,
  type StaffContent,
} from './staffContent';
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

/**
 * 그려진 큰 문장에서 가장 긴 낱말(일반 공백 기준)의 실제 폭을 글자 크기 단위(em)로 잼.
 * 낱말이 여러 줄로 나뉘어 있어도 조각 폭을 더하므로 크기와 무관한 값이 나옵니다.
 * Range.getClientRects가 없거나(테스트 환경) 그려지지 않았으면 null.
 */
function measureLongestWordEm(el: HTMLElement): number | null {
  const node = el.firstChild;
  const px = parseFloat(getComputedStyle(el).fontSize);
  if (!(node instanceof Text) || !(px > 0) || typeof document.createRange !== 'function') return null;
  const range = document.createRange();
  if (typeof range.getClientRects !== 'function') return null;
  const text = node.data;
  let max = 0;
  const re = /[^ \t\r\n]+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    range.setStart(node, m.index);
    range.setEnd(node, m.index + m[0].length);
    let w = 0;
    for (const r of range.getClientRects()) w += r.width;
    max = Math.max(max, w);
  }
  return max > 0 ? Math.round((max / px) * 1000) / 1000 : null;
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

  const content = useMemo(
    () => resolveStaffContent(parsePhraseInput(location.state), { cart, currentPlaceId, takeout }),
    [location.state, cart, currentPlaceId, takeout],
  );
  // 처음 단계는 화면을 열 때의 문장 길이로 (짧으면 64px, 길면 56px)
  const [level, setLevel] = useState(() => staffDefaultLevel(content ? staffKo(content) : ''));

  // 큰 문장(화면 표시용): 수량 단위 앞은 줄바꿈 없는 공백
  const ko = content ? staffKo(content) : '';
  const shown = content?.kind === 'order' ? keepCountersTogether(ko, content.lines) : ko;
  // 큰 문장 줄 폭(px)과 가장 긴 낱말의 실제 폭(em): 낱말이 한 줄에 들어가는 크기 계산에 씀
  // (T6.7 M-04·R1 M-01). 폭은 크기가 바뀌어도 그대로, 낱말 em은 글꼴(Pretendard·대체 글꼴)에 따라
  // 달라지므로 그려진 글자를 직접 잼. 잴 수 없으면(첫 그리기 전·테스트 환경) 각각 null → 추정값·단계 크기
  const sentenceRef = useRef<HTMLParagraphElement>(null);
  const [lineWidth, setLineWidth] = useState<number | null>(null);
  const [measuredEm, setMeasuredEm] = useState<number | null>(null);
  const hasContent = content !== null;
  useLayoutEffect(() => {
    const el = sentenceRef.current;
    if (!el) return;
    const read = () => {
      setLineWidth(el.clientWidth > 0 ? el.clientWidth : null);
      const em = measureLongestWordEm(el);
      setMeasuredEm((prev) => (em !== null && prev !== null && Math.abs(prev - em) < 0.01 ? prev : em));
    };
    read();
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fonts?.addEventListener?.('loadingdone', read);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      fonts?.removeEventListener?.('loadingdone', read);
    };
  }, [hasContent, shown]);
  // 잰 값에는 반올림·부분 픽셀 여유 1%
  const wordEm = measuredEm !== null ? measuredEm * 1.01 : staffLongestWordEm(shown);
  // 실제 표시 크기와, 크기를 실제로 바꾸는 다음·이전 단계(없으면 null → 버튼 비활성)
  const size = staffSizeControls(ko, level, wordEm, lineWidth);

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

  /** 짙은 파랑 띠: 닫기 · 글자 크기 (손님이 다루는 부분이라 손님 언어) */
  const band = (
    <header className="staff__band">
      <button type="button" className="staff__close" onClick={close}>
        <Icon name="close" size={22} />
        {t('common.close')}
      </button>
      <h1 className="sr-only">{t('order.showStaff')}</h1>
      {content && (
        <div className="staff__size" role="group" aria-label={t('staff.textSize')}>
          <button
            type="button"
            className="staff__size-btn staff__size-btn--down"
            aria-label={t('staff.smaller')}
            disabled={size.smaller === null}
            onClick={() => size.smaller !== null && setLevel(size.smaller)}
          ></button>
          <button
            type="button"
            className="staff__size-btn staff__size-btn--up"
            aria-label={t('staff.bigger')}
            disabled={size.bigger === null}
            onClick={() => size.bigger !== null && setLevel(size.bigger)}
          ></button>
        </div>
      )}
    </header>
  );

  if (!content) {
    return (
      <section className="screen staff" data-testid="screen-staff">
        {band}
        <div className="staff__sheet staff__empty">
          <p className="staff__empty-title">{t('order.empty')}</p>
          <p className="staff__empty-hint">{t('order.emptyHint')}</p>
          <Button variant="ink" onClick={() => navigate(PATHS.course)}>
            {t('nav.course')}
          </Button>
        </div>
      </section>
    );
  }

  const meaning = pickL10n(
    lang,
    content.kind === 'order' ? content.sentence.meaning : content.phrase.meaning,
  );
  const total = content.kind === 'order' ? orderTotal(content.lines) : null;
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
      {band}
      <div className="staff__sheet">
        <p className="staff__note" lang="ko" data-testid="staff-note">
          <span className="staff__dot" aria-hidden="true" />
          {content.kind === 'order' ? STAFF_KO.noteOrder : STAFF_KO.noteRequest}
        </p>

        <p
          className="staff__ko"
          lang="ko"
          ref={sentenceRef}
          // 단계 크기를 가장 긴 낱말이 들어가는 크기로 제한하되 56px 아래로는 내리지 않음 (staffSizeControls)
          style={{ fontSize: size.px }}
          data-testid="staff-sentence"
        >
          {shown}
        </p>

        {content.kind === 'order' && (
          <div className="staff__summary">
            <ul className="staff__lines" lang="ko" data-testid="staff-lines">
              {content.lines.map(({ item, qty }, i) => (
                <li key={item.id}>
                  {i > 0 && <span aria-hidden="true">· </span>}
                  {item.ko}{' '}
                  <b className="staff__qty">
                    <span className="num">{qty}</span>
                    {item.counter}
                  </b>
                </li>
              ))}
              {content.takeout && <li data-testid="staff-takeout">· {STAFF_KO.takeoutLine}</li>}
            </ul>
            {total !== null && (
              <span className="staff__total" lang="ko" data-testid="staff-total">
                · {STAFF_KO.sampleTotal} <span className="num">{formatKrw(total)}</span>
              </span>
            )}
          </div>
        )}
        <p className="staff__meaning">{meaning}</p>

        <ListenButton
          variant="pill"
          text={ko}
          label={t('staff.play')}
          onPlay={onPlay}
          className="staff__play"
        >
          <Icon name="speaker" size={20} />
          {t('staff.play')}
        </ListenButton>

        <section className="staff__reply-area" aria-labelledby="staff-reply-h">
          <h2 className="staff__prompt" id="staff-reply-h">
            <span lang="ko">{STAFF_KO.replyPrompt}</span>
            <span className="staff__prompt-sub">{t('staff.staffReply')}</span>
          </h2>
          <div className="staff__replies">
            {REPLY_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                className={cx('staff__reply', `staff__reply--${r}`)}
                data-reply={r}
                onClick={() => onReply(r)}
              >
                <span className="staff__reply-ko" lang="ko">
                  {STAFF_KO.replies[r]}
                </span>
                <small lang={lang}>{plainTitle(t(STAFF_REPLY_KEYS[r].title))}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
