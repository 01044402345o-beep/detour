/**
 * S06 말하기 연습 (T2.4, PRD F-07·F-08 → T6.6 DESIGN.md 새 색·글자 체계, 동작은 그대로).
 * - 듣기(보통·0.75배속)·단어 칩은 ui/ListenButton (TTS 계약은 ListenButton이 지킴).
 * - 마이크는 speech/stt 상태 머신에 연결합니다. 기한(requesting 15초, listening·processing 8초)은
 *   stt가 관리하고, 화면은 상태만 그립니다. 실패 → 재시도/직원에게 보여주기, 미지원 → 직원에게 보여주기만.
 * - 마이크를 켜기 전부터 음성 처리 안내(practice.voiceNotice)를 마이크 버튼 설명으로 항상 보여 줍니다.
 * - 인식 원문은 채점에만 쓰고 state·기록에 남기지 않습니다 (결과 화면에는 점수·일치 여부만).
 */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { scoreSpeech } from '../../domain/scoring';
import { pickL10n, useLang, useT, type MessageKey } from '../../i18n';
import { PATHS } from '../../router/routes';
import { createStt, findRecognition, type RecognitionCtor, type Stt } from '../../speech/stt';
import { getTts, type Tts } from '../../speech/tts';
import { useAppStore } from '../../store/useAppStore';
import type { SttFailureReason, SttState } from '../../types';
import { Card, cx, Icon, ListenButton, Pronunciation } from '../../ui';
import { toResultState } from '../Result/resultState';
import { PracticeHeader } from './PracticeHeader';
import {
  eventRef,
  hasInAppHistory,
  logPracticeEvent,
  navForItem,
  parsePracticeNav,
  resolveSession,
  sentenceFontSize,
  staffInput,
  type PracticeSession,
} from './practiceSession';
import './practice.css';

export type PracticeScreenProps = {
  /** 테스트용 음성인식 주입. undefined = 브라우저 기본, null = 미지원 */
  Recognition?: RecognitionCtor | null;
  /** 테스트용 TTS 주입 */
  tts?: Tts;
};

const ACTIVE: ReadonlySet<SttState['status']> = new Set(['requesting', 'listening', 'processing']);

const FAIL_BODY: Record<SttFailureReason, MessageKey> = {
  denied: 'stt.denied',
  'no-speech': 'stt.noSpeech',
  timeout: 'stt.timeout',
  network: 'stt.network',
  aborted: 'stt.aborted',
  error: 'stt.error',
};

/** 목업 .wave 막대 26개 높이 */
const WAVE = Array.from({ length: 26 }, (_, i) => ({
  h: 10 + Math.round(Math.abs(Math.sin(i * 1.7)) * 30),
  d: (i % 7) * 0.08,
}));

export default function PracticeScreen({ Recognition, tts }: PracticeScreenProps) {
  const location = useLocation();
  const cart = useAppStore((s) => s.cart);
  const currentPlaceId = useAppStore((s) => s.currentPlaceId);
  const takeout = useAppStore((s) => s.takeout);
  const nav = useMemo(() => parsePracticeNav(location.state), [location.state]);
  const session = useMemo(
    () => (nav ? resolveSession(nav, { cart, currentPlaceId, takeout }) : null),
    [nav, cart, currentPlaceId, takeout],
  );

  // 바로 열기·새로고침·잘못된 ID·빈 주문: 주문은 내 주문, 문장은 문장 모음으로
  if (!session) return <Navigate to={nav?.src === 'order' ? PATHS.order : PATHS.phrases} replace />;

  return (
    <PracticeView key={session.item.key} session={session} Recognition={Recognition} tts={tts} />
  );
}

type ViewProps = { session: PracticeSession; Recognition?: RecognitionCtor | null; tts?: Tts };

function PracticeView({ session, Recognition, tts }: ViewProps) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const noticeId = useId();
  const { item, place } = session;

  const goStaffRef = useRef<() => void>(() => {});
  const onTranscriptRef = useRef<(transcript: string) => void>(() => {});
  const sttRef = useRef<Stt | null>(null);

  const [stt, setStt] = useState<SttState>(() => {
    const supported = Recognition === undefined ? !!findRecognition() : !!Recognition;
    return supported
      ? { status: 'idle' }
      : { status: 'unsupported', actions: { showStaff: () => goStaffRef.current() } };
  });
  /** 인식은 됐지만 채점할 글자가 없음 (F-09: 0점 대신 재시도 안내) */
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    goStaffRef.current = () => navigate(PATHS.staff, { state: staffInput(item) });
    onTranscriptRef.current = (transcript) => {
      const r = scoreSpeech(item.ko, transcript);
      if (r.status === 'empty') {
        logPracticeEvent({ type: 'practice_done', ...eventRef(item) });
        setEmpty(true);
        return;
      }
      logPracticeEvent({ type: 'practice_done', ...eventRef(item), score: r.score });
      navigate(PATHS.result, {
        replace: true,
        state: toResultState(
          navForItem(item, session.hasOrder),
          r,
          item.words.map((w) => w.ko),
        ),
      });
    };
  });

  useEffect(() => {
    const s: Stt = createStt({
      Recognition,
      onShowStaff: () => goStaffRef.current(),
      onState: (next) => {
        if (next.status === 'result') {
          // 원문은 화면 상태에 두지 않고 채점에만 넘긴 뒤 바로 지웁니다
          const { transcript } = next;
          s.reset();
          onTranscriptRef.current(transcript);
          return;
        }
        setStt(next);
      },
    });
    sttRef.current = s;
    return () => {
      s.dispose();
      sttRef.current = null;
    };
  }, [Recognition]);

  const active = ACTIVE.has(stt.status);
  /** ListenButton과 같은 TTS 인스턴스 (R1 M-01: 인식 시작 전 재생 중인 정답 음성을 끊음) */
  const ttsInst = tts ?? getTts();
  const startRecognition = () => {
    setEmpty(false);
    ttsInst.cancel();
    sttRef.current?.start();
  };
  const unsupported = stt.status === 'unsupported';
  const failed = 'actions' in stt;

  const close = () => {
    if (hasInAppHistory()) navigate(-1);
    else navigate(item.kind === 'order' ? PATHS.order : PATHS.phrases, { replace: true });
  };
  const onMic = () => {
    if (active) {
      sttRef.current?.cancel();
      return;
    }
    startRecognition();
  };
  const retry = startRecognition;
  /** fieldset disabled의 보조 장치: 인식 중 듣기 클릭이 ListenButton까지 가지 않게 (클릭을 직접 일으키는 환경 대비) */
  const blockWhileActive = active ? (e: MouseEvent) => e.stopPropagation() : undefined;
  const showStaff = () => goStaffRef.current();
  const logPlay = () => logPracticeEvent({ type: 'phrase_play', ...eventRef(item) });

  const statusText =
    stt.status === 'requesting'
      ? t('practice.requesting')
      : stt.status === 'listening'
        ? t('practice.listening')
        : stt.status === 'processing'
          ? t('practice.processing')
          : t('practice.tapMic');

  let problem: { title: string; body: string; canRetry: boolean } | null = null;
  if (unsupported) {
    problem = { title: t('stt.unsupportedTitle'), body: t('stt.unsupported'), canRetry: false };
  } else if (failed) {
    problem = {
      title: t(stt.status === 'denied' ? 'stt.deniedTitle' : 'stt.failTitle'),
      body: t(FAIL_BODY[stt.status as SttFailureReason]),
      canRetry: 'retry' in stt.actions,
    };
  } else if (empty && stt.status === 'idle') {
    problem = { title: t('stt.failTitle'), body: t('stt.empty'), canRetry: true };
  }

  return (
    <section className="screen pr-screen" data-testid="screen-practice">
      <PracticeHeader index={session.index} total={session.list.length} onClose={close} />
      <h1 className="sr-only">{t('practice.title')}</h1>

      <p className="pr-context">
        {item.kind === 'order' && <>{t('order.title')} · </>}
        {pickL10n(lang, place.name)}
      </p>

      <Card className="pr-card">
        <p className="pr-ko" lang="ko" style={{ fontSize: sentenceFontSize(item.ko) }}>
          {item.ko}
        </p>
        <Pronunciation className="pr-pron" roman={item.roman} kana={item.kana} />
        <p className="pr-mn">“{pickL10n(lang, item.meaning)}”</p>
        {/* 인식 중에는 듣기를 막아 스피커 음성이 인식에 섞이지 않게 (R1 M-01) */}
        <fieldset
          className="pr-ctrl"
          disabled={active}
          onClickCapture={blockWhileActive}
          data-testid="practice-listen-ctrl"
        >
          <ListenButton text={item.ko} variant="pill" tts={tts} onPlay={logPlay} />
          <ListenButton
            text={item.ko}
            rate={0.75}
            variant="pill"
            className="pr-slow"
            showNotice={false}
            tts={tts}
            onPlay={logPlay}
          />
        </fieldset>
      </Card>

      <p className="pr-label">{t('practice.tapWord')}</p>
      <fieldset
        className="pr-words"
        disabled={active}
        onClickCapture={blockWhileActive}
        data-testid="practice-words"
      >
        {item.words.map((w, i) => {
          const meaning = pickL10n(lang, w.meaning);
          return (
            <ListenButton
              key={i}
              text={w.ko}
              variant="bare"
              className="pr-word"
              // 이름 = 보이는 글자 그대로 (WCAG 2.5.3 Label in Name, T3.2 axe). 구분 기호를 넣지 않습니다
              label={`${w.ko} ${meaning}`}
              showNotice={false}
              tts={tts}
            >
              <span lang="ko">{w.ko}</span> <small>{meaning}</small>
            </ListenButton>
          );
        })}
      </fieldset>

      <div className="pr-mic">
        {problem && (
          <div className="pr-fail" role="alert" data-testid="practice-problem">
            <b>{problem.title}</b>
            <p>{problem.body}</p>
            <div className="pr-acts">
              {problem.canRetry && (
                <button type="button" className="pr-act pr-act--ink" onClick={retry}>
                  <Icon name="refresh" size={16} />
                  {t('stt.retry')}
                </button>
              )}
              {/* 재시도할 수 없으면 직원에게 보여주기가 주 동작 (파랑 채움) */}
              <button
                type="button"
                className={cx('pr-act', !problem.canRetry && 'pr-act--ink')}
                onClick={showStaff}
              >
                {t('order.showStaff')}
              </button>
            </div>
          </div>
        )}

        <p
          className={cx(
            'pr-status',
            (stt.status === 'listening' || stt.status === 'processing') && 'on',
          )}
          aria-live="polite"
          data-testid="practice-status"
          data-stt={stt.status}
        >
          {stt.status === 'listening' && <span className="pr-status__dot" aria-hidden="true" />}
          {statusText}
        </p>

        {stt.status === 'requesting' && (
          <div className="pr-acts pr-acts--center">
            <button type="button" className="pr-act" onClick={() => sttRef.current?.cancel()}>
              {t('common.cancel')}
            </button>
            <button type="button" className="pr-act pr-act--ink" onClick={showStaff}>
              {t('order.showStaff')}
            </button>
          </div>
        )}

        <div className={cx('pr-wave', stt.status === 'listening' && 'on')} aria-hidden="true">
          {WAVE.map((b, i) => (
            <i key={i} style={{ '--h': `${b.h}px`, animationDelay: `${b.d}s` } as CSSProperties} />
          ))}
        </div>

        <button
          type="button"
          // 반복 고리(on)는 듣는 중(listening)에만 — DESIGN.md 8장 예외 범위. 그 밖의 진행 상태는 정적(is-active)
          className={cx('pr-micb', active && 'is-active', stt.status === 'listening' && 'on')}
          data-testid="practice-mic"
          aria-label={t(active ? 'practice.micStop' : 'practice.micStart')}
          aria-describedby={noticeId}
          aria-pressed={active}
          disabled={unsupported}
          onClick={onMic}
        >
          <Icon name={active ? 'stop' : 'mic'} size={30} />
        </button>

        <p id={noticeId} className="pr-notice">
          <Icon name="lock" size={13} />
          <span>{t('practice.voiceNotice')}</span>
        </p>
      </div>
    </section>
  );
}
