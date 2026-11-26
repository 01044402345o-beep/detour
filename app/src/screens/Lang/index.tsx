/**
 * S00 인트로 — 첫 실행 화면 (T2.1 언어 선택 → T6.1 인트로로 대체, DESIGN.md 7장 '인트로').
 * - 로고 → 파란 기능 안내판(① 코스 ② 주문 ③ 직원) → 제목·필요성 문장 → 언어 선택 → 시작 버튼.
 * - 안내판 그림 칸(T6.16, 232px)은 영상(IntroStage). 영상이 재생 중이면 영상 시간이 장면을 정하고(4.4초씩),
 *   영상을 못 쓰면(불러오기 실패·재생 거부) 장면별 정지 그림 + 4.4초 타이머로 넘깁니다.
 * - 장면 탭을 직접 고르면 자동 재생이 멈추고 영상은 그 장면만 재생한 뒤 끝 모습에서 멈춥니다.
 *   재생/일시정지 버튼으로 멈추거나 이어서 재생합니다. 움직임 줄이기 설정이면 영상 없이 정지 그림,
 *   자동 재생·재생 버튼 없이 장면 탭으로 이동만 합니다. 타이머는 모두 useEffect에서 정리합니다.
 * - 언어 선택(T2.1 그대로): 같은 name의 네이티브 radio. 누르면 store에 바로 저장되고 문구가 즉시 바뀝니다.
 *   첫 실행(lang null)에는 기본 언어(EN)가 선택된 것으로 보이고, "시작하기"를 누를 때 저장합니다.
 * - 발음 표기 방식 안내(로마자/가타카나)를 선택한 언어에 맞춰 보여 줍니다.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_LANG, useT, type MessageKey } from '../../i18n';
import { LANG_NAMES } from '../../i18n/langNames';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { LANGS } from '../../types';
import { Button, Logo, cx, pronunciationKind } from '../../ui';
import { IntroStage, type IntroMode } from './IntroStage';
import './lang.css';

/** 장면 하나가 머무는 시간(ms) */
export const SCENE_MS = 4400;

const SCENES = ['course', 'order', 'staff'] as const;
type SceneId = (typeof SCENES)[number];

const TAB_KEY: Record<SceneId, MessageKey> = {
  course: 'lang.scenes.course.tab',
  order: 'lang.scenes.order.tab',
  staff: 'lang.scenes.staff.tab',
};
const CAP_KEY: Record<SceneId, MessageKey> = {
  course: 'lang.scenes.course.cap',
  order: 'lang.scenes.order.cap',
  staff: 'lang.scenes.staff.cap',
};

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

/** 움직임 줄이기 설정을 따라가는 값 (설정이 바뀌면 다시 렌더) */
function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduce;
}

/** 번역 문구의 *강조* 부분을 <b>로 (마크업을 사전에 넣지 않기 위한 작은 규칙) */
function withEmphasis(text: string): ReactNode[] {
  return text.split('*').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part));
}

export default function LangScreen() {
  const t = useT();
  const navigate = useNavigate();
  const stored = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const selected = stored ?? DEFAULT_LANG;
  const reduce = useReducedMotion();

  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  /** 사용자가 탭으로 고른 장면을 재생 중(영상은 그 장면 끝에서 멈춤) */
  const [held, setHeld] = useState(false);
  /** 탭을 고를 때마다 +1 → 영상이 그 장면 시작점으로 이동 */
  const [seekToken, setSeekToken] = useState(0);
  /** 영상이 재생 가능한지(아니면 정지 그림 + 타이머) */
  const [videoOk, setVideoOk] = useState(false);
  /** 영상 재생 중 지금 장면 안 진행률(0–1): 탭 진행 막대 */
  const [progress, setProgress] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const autoplay = playing && !reduce;
  const mode: IntroMode = autoplay ? 'auto' : held ? 'segment' : 'paused';
  const id = SCENES[scene];

  // 자동 전환(영상을 못 쓸 때만): 장면마다 SCENE_MS 뒤 다음 장면. 영상이 있으면 영상 시간이 장면을 정함.
  useEffect(() => {
    if (!autoplay || videoOk) return;
    const timer = window.setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, scene, videoOk]);

  /** 사용자가 장면을 직접 고름 → 자동 재생 멈춤, 영상은 그 장면으로 */
  const choose = (i: number, focus = false) => {
    setPlaying(false);
    setHeld(true);
    setScene(i);
    setSeekToken((n) => n + 1);
    if (focus) tabRefs.current[i]?.focus();
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = SCENES.length;
    const next =
      e.key === 'ArrowRight'
        ? (scene + 1) % n
        : e.key === 'ArrowLeft'
          ? (scene - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    choose(next, true);
  };

  const start = () => {
    if (stored === null) setLang(selected);
    navigate(PATHS.home, { replace: true });
  };

  return (
    <section
      className="screen lang-screen"
      data-testid="screen-lang"
      // 화면 문구 언어를 알려 중국어가 일본어 글꼴 모양으로 그려지지 않게 (글꼴 선택·낭독기)
      lang={selected === 'zh' ? 'zh-Hans' : selected}
    >
      <div className="lang-in">
        <Logo size={40} wordmark className="lang-logo" />

        <section className="lang-board" aria-label={t('lang.boardLabel')}>
          <div className="lang-board__head">
            <div className="lang-tabs" role="tablist" aria-label={t('lang.boardLabel')}>
              {SCENES.map((s, i) => {
                const on = i === scene;
                return (
                  <button
                    key={s}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`lang-tab-${s}`}
                    aria-selected={on}
                    aria-controls="lang-scene-panel"
                    tabIndex={on ? 0 : -1}
                    className="lang-tab"
                    data-testid={`lang-scene-tab-${s}`}
                    onClick={() => choose(i)}
                    onKeyDown={onTabKey}
                  >
                    <i className="lang-tab__n num" aria-hidden="true">
                      {i + 1}
                    </i>
                    <span>{t(TAB_KEY[s])}</span>
                    {on && autoplay && (
                      // 영상이 있으면 영상 시간의 장면 안 진행률로, 없으면 4.4초 CSS 애니메이션 (R1 L-03)
                      <span
                        key={`${scene}-${String(autoplay)}-${String(videoOk)}`}
                        className={cx('lang-tab__bar', videoOk && 'lang-tab__bar--video')}
                        aria-hidden="true"
                        data-testid="lang-tab-bar"
                        style={
                          videoOk
                            ? { transform: `scaleX(${progress})` }
                            : { animationDuration: `${SCENE_MS}ms` }
                        }
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {!reduce && (
              <button
                type="button"
                className="lang-play"
                data-testid="lang-play"
                aria-label={t(playing ? 'lang.pause' : 'lang.play')}
                onClick={() => {
                  setPlaying((p) => !p);
                  setHeld(false);
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                  {playing ? (
                    <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  ) : (
                    <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  )}
                </svg>
              </button>
            )}
          </div>

          <div
            className="lang-panel"
            role="tabpanel"
            id="lang-scene-panel"
            aria-labelledby={`lang-tab-${id}`}
            data-testid="lang-scene"
            data-scene={id}
          >
            <IntroStage
              // 움직임 줄이기 설정이 바뀌면 새로 만들어 영상 불러오기 세대를 새로 시작 (R1 M-01)
              key={reduce ? 'still' : 'video'}
              scene={scene}
              mode={mode}
              reduce={reduce}
              seekToken={seekToken}
              onScene={setScene}
              onVideo={setVideoOk}
              onProgress={setProgress}
            />
            <p
              className="lang-cap"
              data-testid="lang-scene-cap"
              aria-live={autoplay ? 'off' : 'polite'}
            >
              {withEmphasis(t(CAP_KEY[id]))}
            </p>
          </div>
        </section>

        <h1 className="lang-title">{t('lang.welcomeTitle')}</h1>
        <p className="lang-lede">{t('lang.lede')}</p>

        <div className="lang-pick">
          <h2 className="sr-only" id="lang-choose">
            {t('lang.choose')}
          </h2>
          <div role="radiogroup" aria-labelledby="lang-choose" className="lang-options">
            {LANGS.map((code) => {
              const on = code === selected;
              return (
                <label
                  key={code}
                  lang={code === 'zh' ? 'zh-Hans' : code}
                  className={cx('lang-opt', on && 'lang-opt--on')}
                  data-testid={`lang-${code}`}
                >
                  <input
                    type="radio"
                    name="lang-choose"
                    value={code}
                    checked={on}
                    onChange={() => setLang(code)}
                    className="sr-only"
                  />
                  <span className="lang-opt__name">{LANG_NAMES[code].name}</span>
                </label>
              );
            })}
          </div>
          <p className="lang-pron" data-testid="lang-pron-note">
            {t(pronunciationKind(selected) === 'kana' ? 'lang.pronKana' : 'lang.pronRoman')}
          </p>
        </div>

        <Button variant="acc" onClick={start} className="lang-start">
          {t('lang.start')}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
        <p className="lang-foot">{t('lang.foot')}</p>
      </div>
    </section>
  );
}
