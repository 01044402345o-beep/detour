/**
 * 음성 가이드 버튼 + 팝업 (T6.14). 버튼을 누르면 팝업(바텀시트)이 열리며 바로 화면 언어로 읽기 시작합니다.
 * - 팝업: 재생/멈춤, 천천히(0.75배), 원고 전체 글(지금 읽는 문장 강조), 음성이 없을 때 안내.
 * - 멈췄다 다시 누르면 멈춘 문장부터, 끝까지 읽었으면 처음부터.
 * - 팝업을 닫거나 화면을 떠나거나 앱이 숨겨지면 멈춥니다. 언어를 바꾸면 멈추고 새 언어 글을 처음부터.
 * - 누를 때마다 음성 상태를 다시 확인하고(R1 M-03), 재생이 오류로 끝나면 '다시 눌러 보세요·글로 읽기' 안내(R1 M-02).
 * - 이모지 없이 앱 아이콘(speaker·stop·slow)과 앱 버튼 모양을 씁니다(사용자 요청).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GuideText } from '../data/guides';
import { useLang, useT } from '../i18n';
import {
  getGuideTts,
  type GuideRate,
  type GuideTts,
  type GuideVoiceState,
} from '../speech/guideTts';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { cx } from './cx';
import './GuidePlayer.css';

export type GuidePlayerProps = {
  guide: GuideText;
  /** 팝업 제목 (코스 이름·장소 이름) */
  title: string;
  /** 버튼 문구 */
  buttonLabel: string;
  testId: string;
  className?: string;
  /** 테스트용 */
  tts?: GuideTts;
};

export function GuidePlayer({ guide, title, buttonLabel, testId, className, tts }: GuidePlayerProps) {
  const t = useT();
  const lang = useLang();
  const engine = tts ?? getGuideTts();
  const engineRef = useRef(engine);
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  const paragraphs = guide[lang];
  // 문단마다 시작 문장 번호
  const { sentences, starts } = useMemo(() => {
    const flat: string[] = [];
    const st: number[] = [];
    for (const p of paragraphs) {
      st.push(flat.length);
      flat.push(...p);
    }
    return { sentences: flat, starts: st };
  }, [paragraphs]);

  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(-1);
  const [rate, setRate] = useState<GuideRate>(1);
  const [voice, setVoice] = useState<GuideVoiceState | null>(() => engine.voiceState(lang));
  /** 마지막 재생이 오류로 끝남 (R1 M-02) */
  const [failed, setFailed] = useState(false);
  // 언어가 바뀌면 멈춘 위치를 버리고 처음부터 (R1 L-02). 렌더 중 이전 값과 비교해 초기화
  const [shownLang, setShownLang] = useState(lang);
  if (shownLang !== lang) {
    setShownLang(lang);
    setCur(-1);
    setPlaying(false);
    setFailed(false);
  }

  // 음성 목록 확인 (늦게 오는 브라우저는 최대 2초)
  useEffect(() => {
    let alive = true;
    engineRef.current.init(lang).then((s) => {
      if (alive) setVoice(s);
    });
    return () => {
      alive = false;
    };
  }, [lang]);

  // 언어가 바뀌면 멈추고 처음부터 / 화면을 떠나면 멈춤 / 앱이 숨겨지면 멈춤
  useEffect(() => {
    const e = engineRef.current;
    return () => e.stop();
  }, [lang]);
  useEffect(() => engineRef.current.bindAutoCancel(), []);

  /** 사용자가 누를 때마다 음성 상태를 다시 봄: 늦게 생기거나 사라진 음성 반영 (R1 M-03) */
  function refreshVoice() {
    const now = engine.voiceState(lang);
    if (now) setVoice(now);
    else {
      const asked = lang;
      engine.init(asked).then((s) => {
        // 그 사이 언어가 바뀌었으면 버림 (R2 L-02)
        if (langRef.current === asked) setVoice(s);
      });
    }
  }

  function start(from: number, r: GuideRate = rate) {
    refreshVoice();
    setFailed(false);
    const res = engine.play(sentences, lang, r, from, {
      onSentence: (i) => setCur(i),
      onEnd: (reason) => {
        setPlaying(false);
        if (reason !== 'stopped') setCur(-1);
        if (reason === 'error') setFailed(true);
      },
    });
    if (res === 'started') {
      setPlaying(true);
      setCur(from);
    } else if (res === 'unsupported') {
      setVoice('unsupported');
    }
  }

  function openAndPlay() {
    setOpen(true);
    setCur(-1);
    start(0);
  }

  function close() {
    engine.stop();
    setOpen(false);
    setPlaying(false);
    setCur(-1);
  }

  function toggle() {
    if (playing) engine.stop();
    else start(cur >= 0 ? cur : 0);
  }

  function toggleSlow() {
    const next: GuideRate = rate === 1 ? 0.75 : 1;
    setRate(next);
    if (playing) start(cur >= 0 ? cur : 0, next);
  }

  const notice =
    voice === 'unsupported'
      ? t('guide.unsupported')
      : failed
        ? t('guide.failed')
        : voice === 'no-voice'
          ? t('guide.noVoice')
          : null;

  return (
    <>
      <button
        type="button"
        className={cx('ui-guide-btn', className)}
        onClick={openAndPlay}
        aria-haspopup="dialog"
        data-testid={testId}
      >
        <Icon name="speaker" size={20} />
        <span>{buttonLabel}</span>
      </button>

      <Sheet open={open} onClose={close} title={title}>
        <div className="ui-guide" data-testid={`${testId}-sheet`}>
          <div className="ui-guide__ctrl">
            <button
              type="button"
              className="ui-btn ui-btn--ink ui-guide__play"
              onClick={toggle}
              data-testid="guide-toggle"
            >
              <Icon name={playing ? 'stop' : 'speaker'} size={20} />
              {playing ? t('guide.stop') : cur >= 0 ? t('guide.resume') : t('guide.play')}
            </button>
            <button
              type="button"
              className={cx('ui-guide__slow', rate === 0.75 && 'is-on')}
              aria-pressed={rate === 0.75}
              onClick={toggleSlow}
              data-testid="guide-slow"
            >
              <Icon name="slow" size={18} />
              {t('guide.slow')}
            </button>
          </div>
          <p className="ui-guide__status" role="status" aria-live="polite">
            {playing ? t('guide.playing') : ''}
          </p>
          {notice && (
            <p className="ui-guide__notice" data-testid="guide-notice">
              <Icon name="info" size={16} />
              <span>{notice}</span>
            </p>
          )}
          <div className="ui-guide__text" lang={lang === 'zh' ? 'zh-Hans' : lang}>
            {paragraphs.map((p, pi) => (
              <p key={pi}>
                {p.map((s, si) => {
                  const i = starts[pi] + si;
                  return (
                    <span
                      key={si}
                      className={cx('ui-guide__s', i === cur && playing && 'is-cur')}
                      data-testid={`guide-s-${i}`}
                    >
                      {s}
                      {lang === 'en' ? ' ' : ''}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}
