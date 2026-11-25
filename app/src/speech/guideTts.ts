/**
 * 음성 가이드 TTS (T6.14). 화면 언어(영어·일본어·중국어)의 브라우저 음성으로 가이드 원고를 문장 단위로 읽습니다.
 * 한국어 문장 듣기(tts.ts, ko-KR 전용)와 별개지만 같은 speechSynthesis를 쓰므로, 한쪽을 재생하면 다른 쪽은 끊깁니다.
 *
 * - 음성 고르기: 언어가 맞는 음성 중 지역(en-US·ja-JP·zh-CN) + 자연스러운 음성 이름(Natural·Neural·Enhanced·
 *   Premium·Google 등) 우선. 중국어는 표준 중국어(zh-CN·cmn → zh-TW 순), 광둥어(zh-HK·yue)는 마지막.
 * - 음성 목록이 늦게 오는 브라우저(안드로이드 Chrome 등)를 위해 `voiceschanged`를 최대 2초 기다립니다(init).
 * - 그 언어 음성이 목록에 없어도 `utterance.lang`을 지정해 한 번 시도합니다(엔진이 언어로 골라 읽는 기기가 있음).
 *   이때 상태는 'no-voice'라 화면은 '음성을 찾지 못함' 안내를 함께 보여 줍니다.
 * - 문장마다 utterance를 하나씩 큐에 넣습니다: 긴 발화가 중간에 끊기는 브라우저 문제 예방 + 지금 읽는 문장 표시.
 *   모든 문장을 사용자 탭 안에서 동기로 큐에 넣습니다(뒤 문장도 사용자 활성화 조건에 걸리지 않게).
 * - onEnd 계약: play 1건당 정확히 1회('done' | 'stopped' | 'error'). stop()·새 play()는 즉시(동기) 'stopped'.
 * - 실패(R1 M-01·M-02): 문장 하나가 오류면 남은 큐를 취소하고 'error'. 실패한 음성은 기억해 다음 재생에서
 *   다른 음성(예: 온라인 음성 실패 → 기기 내장 음성)을 먼저 고릅니다. 오프라인이면 처음부터 내장 음성 우선.
 */
import type { Lang } from '../types';
import { VOICE_WAIT_MS, type TtsEnv } from './tts';

export type GuideRate = 1 | 0.75;
export type GuideVoiceState = 'ready' | 'no-voice' | 'unsupported';
export type GuidePlayResult = 'started' | 'unsupported' | 'not-user-gesture';
export type GuideEndReason = 'done' | 'stopped' | 'error';

/** 언어별 기본 지역 (utterance.lang) */
export const GUIDE_LOCALE: Readonly<Record<Lang, string>> = {
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'localService'>;

const QUALITY = /natural|neural|enhanced|premium|google|siri|online/i;

/** 언어가 맞는지와 우선순위(작을수록 좋음). 맞지 않으면 null */
function rank(v: VoiceLike, lang: Lang): number | null {
  const tag = v.lang.replace('_', '-').toLowerCase();
  const good = QUALITY.test(v.name) ? 0 : 1;
  if (lang === 'en') {
    if (!/^en(-|$)/.test(tag)) return null;
    return (tag === 'en-us' ? 0 : tag === 'en-gb' ? 2 : 4) + good;
  }
  if (lang === 'ja') {
    if (!/^ja(-|$)/.test(tag)) return null;
    return good;
  }
  // zh: 표준 중국어 우선, 광둥어는 마지막
  if (/^(yue)(-|$)/.test(tag) || tag === 'zh-hk' || /cantonese/i.test(v.name)) return 10 + good;
  if (/^(zh|cmn)(-|$)/.test(tag)) {
    if (tag === 'zh-cn' || tag === 'zh-hans' || tag.startsWith('cmn') || tag === 'zh') return good;
    return 4 + good; // zh-TW 등
  }
  return null;
}

export type PickOptions = {
  /** 실패했던 음성 이름: 다른 음성이 있으면 피함 (R1 M-02) */
  avoid?: ReadonlySet<string>;
  /** 오프라인이면 기기 내장(localService) 음성을 먼저 (온라인 음성은 네트워크 없이 실패) */
  offline?: boolean;
};

/** 그 언어로 읽을 음성 (없으면 null) */
export function pickGuideVoice<V extends VoiceLike>(
  voices: readonly V[],
  lang: Lang,
  opts: PickOptions = {},
): V | null {
  let best: V | null = null;
  let bestRank = Infinity;
  for (const v of voices) {
    const base = rank(v, lang);
    if (base === null) continue;
    const r =
      base + (opts.avoid?.has(v.name) ? 100 : 0) + (opts.offline && !v.localService ? 50 : 0);
    if (r < bestRank) {
      best = v;
      bestRank = r;
    }
  }
  return best;
}

export type GuidePlayHandlers = {
  /** 문장 i(전체 문장 순번)를 읽기 시작할 때 */
  onSentence?: (index: number) => void;
  onEnd?: (reason: GuideEndReason) => void;
};

export type GuideTts = {
  /** 지금 알 수 있는 상태(동기). 목록이 아직 비어 있으면 null */
  voiceState(lang: Lang): GuideVoiceState | null;
  /** 목록이 늦게 오면 최대 2초 기다려 상태를 정합니다 */
  init(lang: Lang): Promise<GuideVoiceState>;
  /** 문장들을 from번부터 읽습니다. 사용자 탭 안에서 동기로 부르세요 */
  play(
    sentences: readonly string[],
    lang: Lang,
    rate: GuideRate,
    from: number,
    handlers?: GuidePlayHandlers,
  ): GuidePlayResult;
  stop(): void;
  /** 페이지 숨김·이탈 시 자동 stop. 해제 함수를 돌려줍니다 */
  bindAutoCancel(): () => void;
};

function defaultEnv(): TtsEnv {
  if (typeof window === 'undefined') return {};
  return {
    synth: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance,
    userActivation: window.navigator.userActivation,
    target: window,
    doc: window.document,
  };
}

export function createGuideTts(env: TtsEnv = defaultEnv()): GuideTts {
  const { synth, Utterance, userActivation, target, doc } = env;
  const supported = !!synth && typeof Utterance === 'function';

  type Run = {
    handlers: GuidePlayHandlers;
    done: boolean;
    utterances: SpeechSynthesisUtterance[];
    voiceName: string | null;
  };
  let current: Run | null = null;
  /** 이 페이지에서 재생에 실패한 음성 (다음 재생에서 다른 음성을 먼저 고름) */
  const failedVoices = new Set<string>();
  const isOffline = () =>
    typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false;

  function finish(run: Run, reason: GuideEndReason) {
    if (run.done) return;
    run.done = true;
    for (const u of run.utterances) {
      u.onstart = null;
      u.onend = null;
      u.onerror = null;
    }
    if (current === run) current = null;
    run.handlers.onEnd?.(reason);
  }

  function voiceState(lang: Lang): GuideVoiceState | null {
    if (!supported || !synth) return 'unsupported';
    const voices = synth.getVoices();
    if (voices.length === 0) return null;
    return pickGuideVoice(voices, lang) ? 'ready' : 'no-voice';
  }

  function init(lang: Lang): Promise<GuideVoiceState> {
    const now = voiceState(lang);
    if (now === 'ready' || now === 'unsupported') return Promise.resolve(now);
    const s = synth!;
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        s.removeEventListener('voiceschanged', onChange);
        resolve(voiceState(lang) ?? 'no-voice');
      };
      const onChange = () => {
        if (voiceState(lang) === 'ready') done();
      };
      const timer = setTimeout(done, VOICE_WAIT_MS);
      s.addEventListener('voiceschanged', onChange);
    });
  }

  function stop() {
    const prev = current;
    current = null;
    if (synth) synth.cancel();
    if (prev) finish(prev, 'stopped');
  }

  function play(
    sentences: readonly string[],
    lang: Lang,
    rate: GuideRate,
    from: number,
    handlers: GuidePlayHandlers = {},
  ): GuidePlayResult {
    if (!supported || !synth || !Utterance) return 'unsupported';
    if (userActivation && !userActivation.isActive) return 'not-user-gesture';
    const prev = current;
    current = null;
    synth.cancel();
    const voices = synth.getVoices();
    const voice =
      voices.length > 0
        ? pickGuideVoice(voices, lang, { avoid: failedVoices, offline: isOffline() })
        : null;
    const start = Math.max(0, Math.min(from, sentences.length - 1));
    const run: Run = { handlers, done: false, utterances: [], voiceName: voice?.name ?? null };
    const last = sentences.length - 1;
    for (let i = start; i <= last; i += 1) {
      const u = new Utterance(sentences[i]);
      u.lang = voice?.lang ?? GUIDE_LOCALE[lang];
      if (voice) u.voice = voice;
      u.rate = rate;
      const index = i;
      u.onstart = () => {
        if (!run.done) handlers.onSentence?.(index);
      };
      u.onerror = (e) => {
        const err = (e as SpeechSynthesisErrorEvent).error;
        if (err === 'interrupted' || err === 'canceled') {
          // 우리 stop()·play()가 끊은 것은 이미 처리됨(current가 비어 있음).
          // 다른 재생(한국어 문장 듣기 등)이 speechSynthesis를 끊었으면 여기서 'stopped'로 마무리
          if (current === run) finish(run, 'stopped');
          return;
        }
        // 진짜 실패: 이 재생의 남은 문장을 큐에서 지우고(뒤 문장이 몰래 계속 나오지 않게, R1 M-01),
        // 그 음성은 다음 재생에서 피합니다(R1 M-02). 콜백은 finish가 먼저 떼므로 취소 이벤트는 무시됨
        if (run.done) return;
        if (run.voiceName) failedVoices.add(run.voiceName);
        // 취소를 먼저 하고 나서 알립니다: onEnd 안에서 새 재생을 시작해도 그 재생을 지우지 않게 (R2 L-01)
        if (current === run) {
          current = null;
          synth?.cancel();
        }
        finish(run, 'error');
      };
      if (i === last) u.onend = () => finish(run, 'done');
      run.utterances.push(u);
    }
    current = run;
    // 일부 브라우저(Chrome)는 일시정지 상태로 남아 있으면 큐를 읽지 않음
    synth.resume?.();
    for (const u of run.utterances) synth.speak(u);
    if (prev) finish(prev, 'stopped');
    return 'started';
  }

  function bindAutoCancel(): () => void {
    if (!target) return () => {};
    const onHide = () => stop();
    const onVisibility = () => {
      if (doc?.visibilityState === 'hidden') stop();
    };
    target.addEventListener('pagehide', onHide);
    doc?.addEventListener('visibilitychange', onVisibility);
    return () => {
      target.removeEventListener('pagehide', onHide);
      doc?.removeEventListener('visibilitychange', onVisibility);
    };
  }

  return { voiceState, init, play, stop, bindAutoCancel };
}

let shared: GuideTts | null = null;

/** 앱 전체에서 쓰는 가이드 TTS (지연 생성) */
export function getGuideTts(): GuideTts {
  if (!shared) shared = createGuideTts();
  return shared;
}
