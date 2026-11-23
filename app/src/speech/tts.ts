/**
 * T1.5 TTS 어댑터 (PRD F-07). 브라우저 음성합성(ko-KR)으로 읽어 줍니다.
 *
 * - 한국어 음성 찾기: getVoices()에 없으면 `voiceschanged`를 최대 2초 기다립니다.
 * - 사용자 탭에서만 시작: `speak()`는 클릭 핸들러 안에서 동기적으로 부르세요.
 *   `navigator.userActivation`이 있는 브라우저에서는 활성화가 없으면 시작하지 않습니다.
 * - 화면 이탈 시 `cancel()`: 화면 컴포넌트의 effect cleanup에서 부르고,
 *   페이지 숨김·이탈은 `bindAutoCancel()`이 처리합니다.
 * - 음성 목록 재확인: `speak()`·`init()`은 매번 getVoices()를 동기로 다시 봅니다.
 *   첫 탐색에서 못 찾은 한국어 음성이 나중에 생기면 'ready'로, 고른 음성이 사라지면 다시 고릅니다.
 *   빈 목록은 일시적인 것으로 보고 상태 판단을 유지하되(그 발화에는 voice를 지정하지 않음),
 *   다음 `init()`에서 최대 2초 재확인 후 확정합니다(계속 비면 'no-korean-voice').
 * - onEnd 계약: 발화 요청 1건당 정확히 1회. 끝·오류이면 그때, 새 speak()로 선점되거나
 *   cancel()되면 즉시(동기) 호출하고, 그 발화의 늦은 end·error 이벤트는 무시합니다.
 * - 'started'는 브라우저 발화 큐에 넣었다는 뜻이며 재생 성공을 보장하지 않습니다.
 */
import type { TtsState } from '../types';

/** 보통·0.75배속 (F-07) */
export type TtsRate = 1 | 0.75;

export type SpeakResult = 'started' | 'unsupported' | 'not-user-gesture';

/** 테스트에서 목으로 바꿀 수 있는 최소 환경 */
export type TtsEnv = {
  synth?: SpeechSynthesis;
  Utterance?: typeof SpeechSynthesisUtterance;
  userActivation?: { readonly isActive: boolean };
  /** pagehide·visibilitychange 구독 대상 */
  target?: Window;
  doc?: Document;
};

export const VOICE_WAIT_MS = 2000;

export type Tts = {
  /** 한국어 음성을 찾아 상태를 정합니다. 진행 중 탐색은 합치고, 못 찾았으면 다음 호출에서 다시 찾습니다. */
  init(): Promise<TtsState>;
  /** API가 없으면 'unsupported'. 있으면 init 완료 전까지 null(음성 탐색 중) */
  getState(): TtsState | null;
  speak(text: string, rate?: TtsRate, onEnd?: () => void): SpeakResult;
  cancel(): void;
  /** 페이지 숨김·이탈 시 자동 cancel. 해제 함수를 돌려줍니다. */
  bindAutoCancel(): () => void;
};

export function isKoreanVoice(v: Pick<SpeechSynthesisVoice, 'lang'>): boolean {
  return /^ko([-_]|$)/i.test(v.lang);
}

function pickKorean(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ko = voices.filter(isKoreanVoice);
  if (ko.length === 0) return null;
  // ko-KR 로컬 음성 우선 (오프라인에서도 동작)
  return (
    ko.find((v) => /^ko[-_]KR$/i.test(v.lang) && v.localService) ??
    ko.find((v) => /^ko[-_]KR$/i.test(v.lang)) ??
    ko[0]
  );
}

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

export function createTts(env: TtsEnv = defaultEnv()): Tts {
  const { synth, Utterance, userActivation, target, doc } = env;
  const supported = !!synth && typeof Utterance === 'function';

  let state: TtsState | null = supported ? null : 'unsupported';
  let voice: SpeechSynthesisVoice | null = null;
  let searching: Promise<TtsState> | null = null;

  type Entry = { u: SpeechSynthesisUtterance; onEnd?: () => void; done: boolean };
  let current: Entry | null = null;

  /**
   * 현재 음성 목록을 동기로 다시 확인합니다. 목록을 실제로 봤으면 true.
   * 빈 목록(로드 전·일시적)이면 false를 돌려주고 판단을 바꾸지 않습니다 — 확정은 init()의 2초 재확인이 합니다.
   */
  function refreshVoice(): boolean {
    if (!synth) return false;
    const voices = synth.getVoices();
    if (voices.length === 0) return false;
    const v = pickKorean(voices);
    voice = v;
    if (v) state = 'ready';
    else if (state !== null) state = 'no-korean-voice';
    return true;
  }

  function finish(e: Entry) {
    if (e.done) return;
    e.done = true;
    e.u.onend = null;
    e.u.onerror = null;
    if (current === e) current = null;
    e.onEnd?.();
  }

  function findVoice(s: SpeechSynthesis): Promise<SpeechSynthesisVoice | null> {
    const now = pickKorean(s.getVoices());
    if (now) return Promise.resolve(now);
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: SpeechSynthesisVoice | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        s.removeEventListener('voiceschanged', onChange);
        resolve(v);
      };
      const onChange = () => {
        const v = pickKorean(s.getVoices());
        if (v) finish(v);
      };
      const timer = setTimeout(() => finish(pickKorean(s.getVoices())), VOICE_WAIT_MS);
      s.addEventListener('voiceschanged', onChange);
    });
  }

  function init(): Promise<TtsState> {
    if (!supported || !synth) return Promise.resolve('unsupported');
    if (searching) return searching;
    // 비어 있지 않은 목록에서 ready를 확인했을 때만 바로 끝냅니다 (빈 목록이면 2초 재확인)
    if (refreshVoice() && state === 'ready') return Promise.resolve(state);
    const p = findVoice(synth).then((v) => {
      voice = v;
      state = v ? 'ready' : 'no-korean-voice';
      if (searching === p) searching = null;
      return state;
    });
    searching = p;
    return p;
  }

  /** 현재 발화를 끊고, 그 onEnd를 즉시 1회 호출합니다 */
  function cancel() {
    const prev = current;
    current = null;
    if (synth) synth.cancel();
    if (prev) finish(prev);
  }

  function speak(text: string, rate: TtsRate = 1, onEnd?: () => void): SpeakResult {
    if (!supported || !synth || !Utterance) return 'unsupported';
    if (userActivation && !userActivation.isActive) return 'not-user-gesture';
    // 이전 발화가 쌓이지 않게 먼저 끊습니다
    const prev = current;
    current = null;
    synth.cancel();
    // 사용자 탭 안에서 동기로 목록 재확인 (await 하면 사용자 활성화를 잃음)
    const seen = refreshVoice();
    const u = new Utterance(text);
    u.lang = 'ko-KR';
    u.rate = rate;
    // 한국어 음성이 없더라도 lang 지정으로 시도합니다. 안내 표시는 UI가 getState()로 판단(F-07).
    // 빈 목록이면 목록에 없는 voice 객체를 넘기지 않고 lang만으로 맡깁니다
    if (seen && voice) u.voice = voice;
    const entry: Entry = { u, onEnd, done: false };
    u.onend = () => finish(entry);
    u.onerror = () => finish(entry);
    current = entry;
    synth.speak(u);
    // 선점된 이전 발화의 onEnd는 새 발화를 큐에 넣은 뒤 호출 (그 안에서 speak를 다시 불러도 안전)
    if (prev) finish(prev);
    return 'started';
  }

  function bindAutoCancel(): () => void {
    if (!target) return () => {};
    const onHide = () => cancel();
    const onVisibility = () => {
      if (doc?.visibilityState === 'hidden') cancel();
    };
    target.addEventListener('pagehide', onHide);
    doc?.addEventListener('visibilitychange', onVisibility);
    return () => {
      target.removeEventListener('pagehide', onHide);
      doc?.removeEventListener('visibilitychange', onVisibility);
    };
  }

  return { init, getState: () => state, speak, cancel, bindAutoCancel };
}

let shared: Tts | null = null;

/** 앱 전체에서 쓰는 TTS 인스턴스 (지연 생성) */
export function getTts(): Tts {
  if (!shared) shared = createTts();
  return shared;
}
