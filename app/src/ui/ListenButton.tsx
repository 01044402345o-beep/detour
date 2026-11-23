import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { getTts, type Tts, type TtsRate } from '../speech/tts';
import type { TtsState } from '../types';
import { cx } from './cx';
import { Icon } from './Icon';
import { useTtsState } from './useTtsState';

export type ListenButtonProps = {
  /** 읽을 한국어 (문장 또는 단어 칩의 ko) */
  text: string;
  /** 1 = 보통, 0.75 = 천천히 (F-07) */
  rate?: TtsRate;
  /**
   * 'round' = 목업 .playb 동그란 버튼(아이콘만), 'pill' = 목업 .ctrl 알약(아이콘+문구),
   * 'bare' = 모양 없이(단어 칩 등 감싸는 쪽이 스타일 지정)
   */
  variant?: 'round' | 'pill' | 'bare';
  /** 보이는 내용. 생략하면 variant에 맞는 아이콘·문구 */
  children?: ReactNode;
  /** 화면 낭독기 이름. 생략하면 '듣기'/'천천히 듣기' 번역 문구 */
  label?: string;
  /** no-korean-voice·unsupported 안내를 버튼 아래에 표시 (한 화면에 여러 개면 하나만 true 권장) */
  showNotice?: boolean;
  /** speak()가 'started'를 돌려준 뒤 호출 (phrase_play 이벤트 기록 등) */
  onPlay?: () => void;
  className?: string;
  /** 테스트용 주입. 기본은 앱 공용 인스턴스 getTts() */
  tts?: Tts;
};

/** TTS 상태 → 안내 문구 키 (ready·탐색 중이면 없음) */
function noticeKey(state: TtsState | null) {
  if (state === 'unsupported') return 'audio.ttsUnsupported' as const;
  if (state === 'no-korean-voice') return 'audio.noKoreanVoice' as const;
  return null;
}

/**
 * 공용 듣기 버튼 (F-07). TTS 사용 계약 (T1.5 R2·R3, task.md T2.0):
 *  ① 마운트 시 init(), 끝나면 getState()로 안내 갱신 (언마운트 뒤 결과 무시) — useTtsState
 *  ② 탭 핸들러에서 init()을 기다리지 않고 speak()를 동기로 호출 (사용자 활성화 유지)
 *  ③ onEnd는 선점·취소된 요청에도 1회 오므로 자기 요청 번호가 맞을 때만 재생 표시를 끔
 *  ④ 언마운트(화면 이탈) cleanup에서 자기 요청이 재생 중이면 cancel().
 *     페이지 숨김·이탈 자동 취소(bindAutoCancel)는 App.tsx에서 1회 등록합니다.
 */
export function ListenButton({
  text,
  rate = 1,
  variant = 'round',
  children,
  label,
  showNotice = true,
  onPlay,
  className,
  tts: ttsProp,
}: ListenButtonProps) {
  const t = useT();
  const tts = ttsProp ?? getTts();
  const { state, refresh } = useTtsState(tts);
  const [playing, setPlaying] = useState(false);
  /** 이 버튼이 낸 마지막 요청 번호 (0 = 없음) */
  const reqRef = useRef(0);
  /** 재생 중인 요청 번호 (0 = 재생 안 함) — cleanup에서 cancel 여부 판단 */
  const activeRef = useRef(0);
  const ttsRef = useRef(tts);

  useEffect(() => {
    ttsRef.current = tts;
  }, [tts]);

  useEffect(
    () => () => {
      // ④ 화면 이탈: 이 버튼의 요청이 아직 재생 중이면 멈춤 (다른 버튼의 재생은 건드리지 않음)
      if (activeRef.current !== 0) {
        activeRef.current = 0;
        reqRef.current += 1; // 늦게 오는 onEnd 무시
        ttsRef.current.cancel();
      }
    },
    [],
  );

  const onClick = () => {
    const id = ++reqRef.current;
    activeRef.current = id;
    setPlaying(true);
    // ② init을 기다리지 않고 동기 호출. 선점된 이전 요청의 onEnd가 이 안에서 동기로 올 수 있음
    const result = tts.speak(text, rate, () => {
      // ③ 자기 요청만 재생 표시를 끔
      if (reqRef.current !== id) return;
      activeRef.current = 0;
      setPlaying(false);
    });
    refresh(); // speak()가 음성 목록을 다시 보고 상태를 바꿨을 수 있음
    if (result === 'started') {
      onPlay?.();
    } else if (reqRef.current === id) {
      activeRef.current = 0;
      setPlaying(false);
    }
  };

  const notice = showNotice ? noticeKey(state) : null;
  const name = label ?? t(rate === 0.75 ? 'audio.listenSlow' : 'audio.listen');
  const content =
    children ??
    (variant === 'pill' ? (
      <>
        <Icon name={rate === 0.75 ? 'slow' : 'speaker'} size={16} />
        {name}
      </>
    ) : (
      <Icon name={rate === 0.75 ? 'slow' : 'speaker'} size={20} />
    ));

  return (
    <>
      <button
        type="button"
        className={cx('ui-listen', variant !== 'bare' && `ui-listen--${variant}`, className)}
        aria-label={variant === 'pill' && !children && !label ? undefined : name}
        aria-pressed={playing}
        disabled={state === 'unsupported'}
        onClick={onClick}
        data-tts-state={state ?? 'pending'}
      >
        {content}
      </button>
      {notice && (
        <span className="ui-listen-notice" role="note">
          {t(notice)}
        </span>
      )}
    </>
  );
}
