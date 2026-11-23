import { VOICE_WAIT_MS, createTts, isKoreanVoice, type TtsEnv } from './tts';

type Voice = Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'localService'>;

/** speechSynthesis 목 */
class MockSynth extends EventTarget {
  voices: Voice[] = [];
  spoken: MockUtterance[] = [];
  cancels = 0;
  getVoices() {
    return this.voices as SpeechSynthesisVoice[];
  }
  /** 재생 대기·재생 중인 발화 */
  queue: MockUtterance[] = [];
  speak(u: MockUtterance) {
    this.spoken.push(u);
    this.queue.push(u);
  }
  /** 크롬처럼 취소된 발화의 error('interrupted')를 비동기로 늦게 보냅니다 */
  cancel() {
    this.cancels++;
    const dropped = this.queue;
    this.queue = [];
    queueMicrotask(() => dropped.forEach((u) => u.onerror?.()));
  }
  /** 맨 앞 발화가 정상 종료 */
  endFront() {
    const u = this.queue.shift();
    u?.onend?.();
  }
  setVoices(v: Voice[]) {
    this.voices = v;
    this.dispatchEvent(new Event('voiceschanged'));
  }
}

class MockUtterance {
  lang = '';
  rate = 1;
  voice: Voice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

const ko: Voice = { lang: 'ko-KR', name: 'Yuna', localService: true };
const en: Voice = { lang: 'en-US', name: 'Sam', localService: true };

function env(synth: MockSynth, extra: Partial<TtsEnv> = {}): TtsEnv {
  return {
    synth: synth as unknown as SpeechSynthesis,
    Utterance: MockUtterance as unknown as typeof SpeechSynthesisUtterance,
    ...extra,
  };
}

afterEach(() => vi.useRealTimers());

describe('tts 음성 찾기', () => {
  it('API가 없으면 unsupported, speak도 unsupported', async () => {
    const tts = createTts({});
    expect(tts.getState()).toBe('unsupported');
    await expect(tts.init()).resolves.toBe('unsupported');
    expect(tts.speak('네')).toBe('unsupported');
    expect(() => tts.cancel()).not.toThrow();
  });

  it('이미 한국어 음성이 있으면 바로 ready', async () => {
    const synth = new MockSynth();
    synth.voices = [en, ko];
    const tts = createTts(env(synth));
    expect(tts.getState()).toBeNull();
    await expect(tts.init()).resolves.toBe('ready');
    expect(tts.getState()).toBe('ready');
  });

  it('voiceschanged로 늦게 오는 한국어 음성을 기다린다', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    const tts = createTts(env(synth));
    const p = tts.init();
    vi.advanceTimersByTime(500);
    synth.setVoices([en]); // 한국어 아님 → 계속 대기
    vi.advanceTimersByTime(500);
    synth.setVoices([en, ko]);
    await expect(p).resolves.toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('2초 안에 한국어 음성이 없으면 no-korean-voice', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    synth.voices = [en];
    const tts = createTts(env(synth));
    const p = tts.init();
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(VOICE_WAIT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe('no-korean-voice');
    expect(VOICE_WAIT_MS).toBe(2000);
  });

  it('진행 중 탐색은 합친다', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    const add = vi.spyOn(synth, 'addEventListener');
    const tts = createTts(env(synth));
    const a = tts.init();
    const b = tts.init();
    expect(b).toBe(a);
    expect(add).toHaveBeenCalledTimes(1);
    synth.setVoices([ko]);
    await expect(a).resolves.toBe('ready');
  });

  it('첫 탐색이 no-korean-voice여도 뒤에 생긴 한국어 음성을 init이 찾는다', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    synth.voices = [en];
    const tts = createTts(env(synth));
    const p = tts.init();
    await vi.advanceTimersByTimeAsync(VOICE_WAIT_MS);
    await expect(p).resolves.toBe('no-korean-voice');
    synth.setVoices([en, ko]);
    await expect(tts.init()).resolves.toBe('ready');
    expect(tts.getState()).toBe('ready');
  });

  it('no-korean-voice 뒤 한국어 음성이 생기면 speak가 동기로 반영한다', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    synth.voices = [en];
    const tts = createTts(env(synth));
    const p = tts.init();
    await vi.advanceTimersByTimeAsync(VOICE_WAIT_MS);
    await p;
    synth.voices = [en, ko];
    expect(tts.speak('네')).toBe('started');
    expect(synth.spoken[0].voice).toBe(ko);
    expect(tts.getState()).toBe('ready');
  });

  it('고른 음성이 사라지면 speak는 그 음성을 지정하지 않는다', async () => {
    const synth = new MockSynth();
    const other: Voice = { lang: 'ko-KR', name: 'Other', localService: false };
    synth.voices = [ko, other];
    const tts = createTts(env(synth));
    await tts.init();
    synth.voices = [other];
    tts.speak('네');
    expect(synth.spoken[0].voice).toBe(other);
    synth.voices = [en];
    tts.speak('네');
    expect(synth.spoken[1].voice).toBeNull();
    expect(tts.getState()).toBe('no-korean-voice');
  });

  it('목록이 일시적으로 비면 판단은 유지하고 그 발화에는 voice를 지정하지 않는다', async () => {
    const synth = new MockSynth();
    synth.voices = [ko];
    const tts = createTts(env(synth));
    await tts.init();
    synth.voices = [];
    tts.speak('네');
    expect(tts.getState()).toBe('ready');
    expect(synth.spoken[0].voice).toBeNull();
    expect(synth.spoken[0].lang).toBe('ko-KR');
  });

  it('ready 뒤 목록이 계속 비면 init이 2초 재확인 후 no-korean-voice로 확정', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    synth.voices = [ko];
    const tts = createTts(env(synth));
    await expect(tts.init()).resolves.toBe('ready');
    synth.voices = [];
    const p = tts.init();
    await vi.advanceTimersByTimeAsync(VOICE_WAIT_MS);
    await expect(p).resolves.toBe('no-korean-voice');
    expect(tts.getState()).toBe('no-korean-voice');
    tts.speak('네');
    expect(synth.spoken[0].voice).toBeNull();
  });

  it('ready 뒤 일시적 빈 목록은 init 재확인 중 한국어 음성이 돌아오면 ready로 회복', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    synth.voices = [ko];
    const tts = createTts(env(synth));
    await tts.init();
    synth.voices = [];
    const p = tts.init();
    await vi.advanceTimersByTimeAsync(1000);
    synth.setVoices([ko]);
    await expect(p).resolves.toBe('ready');
    expect(tts.getState()).toBe('ready');
    tts.speak('네');
    expect(synth.spoken[0].voice).toBe(ko);
  });

  it('빈 목록을 보자마자 강등하지 않는다 (init 결과 전까지 ready 유지)', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    synth.voices = [ko];
    const tts = createTts(env(synth));
    await tts.init();
    synth.voices = [];
    const p = tts.init();
    expect(tts.getState()).toBe('ready');
    await vi.advanceTimersByTimeAsync(VOICE_WAIT_MS - 1);
    expect(tts.getState()).toBe('ready');
    await vi.advanceTimersByTimeAsync(1);
    await p;
  });

  it('isKoreanVoice: ko, ko-KR, ko_KR만', () => {
    expect(isKoreanVoice({ lang: 'ko-KR' })).toBe(true);
    expect(isKoreanVoice({ lang: 'ko_KR' })).toBe(true);
    expect(isKoreanVoice({ lang: 'ko' })).toBe(true);
    expect(isKoreanVoice({ lang: 'kok-IN' })).toBe(false);
    expect(isKoreanVoice({ lang: 'en-US' })).toBe(false);
  });

  it('ko-KR 로컬 음성을 우선 고른다', async () => {
    const synth = new MockSynth();
    const remote: Voice = { lang: 'ko-KR', name: 'Remote', localService: false };
    synth.voices = [remote, ko];
    const tts = createTts(env(synth, { userActivation: { isActive: true } }));
    await tts.init();
    tts.speak('네');
    expect(synth.spoken[0].voice).toBe(ko);
  });
});

describe('tts speak·cancel', () => {
  it('사용자 탭(활성화) 안에서만 시작한다', async () => {
    const synth = new MockSynth();
    synth.voices = [ko];
    const activation = { isActive: false };
    const tts = createTts(env(synth, { userActivation: activation }));
    await tts.init();
    expect(tts.speak('네')).toBe('not-user-gesture');
    expect(synth.spoken).toHaveLength(0);
    activation.isActive = true;
    expect(tts.speak('네')).toBe('started');
    expect(synth.spoken).toHaveLength(1);
  });

  it('ko-KR·속도·음성을 지정하고 이전 발화를 끊는다', async () => {
    const synth = new MockSynth();
    synth.voices = [ko];
    const tts = createTts(env(synth));
    await tts.init();
    tts.speak('김치찌개 하나 주세요', 0.75);
    const u = synth.spoken[0];
    expect(u.text).toBe('김치찌개 하나 주세요');
    expect(u.lang).toBe('ko-KR');
    expect(u.rate).toBe(0.75);
    expect(u.voice).toBe(ko);
    expect(synth.cancels).toBe(1);
    tts.speak('네');
    expect(synth.spoken[1].rate).toBe(1);
    expect(synth.cancels).toBe(2);
  });

  it('한국어 음성이 없어도 lang 지정으로 시도한다 (안내는 UI가 상태로)', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    const tts = createTts(env(synth));
    const p = tts.init();
    await vi.advanceTimersByTimeAsync(VOICE_WAIT_MS);
    await p;
    expect(tts.getState()).toBe('no-korean-voice');
    expect(tts.speak('네')).toBe('started');
    expect(synth.spoken[0].voice).toBeNull();
    expect(synth.spoken[0].lang).toBe('ko-KR');
  });

  it('onEnd: 정상 종료 시 1회, 이후 이벤트로 추가 호출 없음', async () => {
    const synth = new MockSynth();
    const tts = createTts(env(synth));
    const onEnd = vi.fn();
    tts.speak('네', 1, onEnd);
    const u = synth.spoken[0];
    synth.endFront();
    u.onerror?.();
    await Promise.resolve();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('onEnd: 오류 종료 시 1회', () => {
    const synth = new MockSynth();
    const tts = createTts(env(synth));
    const onEnd = vi.fn();
    tts.speak('네', 1, onEnd);
    synth.spoken[0].onerror?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('선점: 이전 발화 onEnd는 즉시 1회, 늦은 interrupted가 새 발화 onEnd를 부르지 않는다', async () => {
    const synth = new MockSynth();
    const tts = createTts(env(synth));
    const onEndA = vi.fn();
    const onEndB = vi.fn();
    tts.speak('김치', 1, onEndA);
    tts.speak('찌개', 1, onEndB);
    expect(onEndA).toHaveBeenCalledTimes(1);
    await Promise.resolve(); // 비동기 interrupted 도착
    await Promise.resolve();
    expect(onEndA).toHaveBeenCalledTimes(1);
    expect(onEndB).not.toHaveBeenCalled();
    synth.endFront();
    expect(onEndB).toHaveBeenCalledTimes(1);
  });

  it('cancel: 현재 발화 onEnd 즉시 1회, 늦은 error로 추가 호출 없음', async () => {
    const synth = new MockSynth();
    const tts = createTts(env(synth));
    const onEnd = vi.fn();
    tts.speak('네', 1, onEnd);
    tts.cancel();
    expect(synth.cancels).toBe(2);
    expect(onEnd).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    tts.cancel();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('cancel이 동기로 error를 보내는 브라우저에서도 1회', () => {
    const synth = new MockSynth();
    synth.cancel = function () {
      this.cancels++;
      const dropped = this.queue;
      this.queue = [];
      dropped.forEach((u) => u.onerror?.());
    };
    const tts = createTts(env(synth));
    const onEndA = vi.fn();
    const onEndB = vi.fn();
    tts.speak('김치', 1, onEndA);
    tts.speak('찌개', 1, onEndB);
    tts.cancel();
    expect(onEndA).toHaveBeenCalledTimes(1);
    expect(onEndB).toHaveBeenCalledTimes(1);
  });

  it('onEnd 안에서 다시 speak해도 새 발화가 현재 발화로 남는다', () => {
    const synth = new MockSynth();
    const tts = createTts(env(synth));
    const onEndC = vi.fn();
    tts.speak('A', 1, () => tts.speak('C', 1, onEndC));
    tts.speak('B', 1);
    // A 선점 → onEndA 안에서 C 시작 → B 선점
    expect(synth.spoken.map((u) => u.text)).toEqual(['A', 'B', 'C']);
    expect(onEndC).not.toHaveBeenCalled();
    tts.cancel();
    expect(onEndC).toHaveBeenCalledTimes(1);
  });

  it('API가 없어도 cancel은 안전', () => {
    expect(() => createTts({}).cancel()).not.toThrow();
  });

  it('bindAutoCancel: pagehide·숨김 시 cancel, 해제 후에는 안 함', () => {
    const synth = new MockSynth();
    const tts = createTts(env(synth, { target: window, doc: document }));
    const off = tts.bindAutoCancel();
    window.dispatchEvent(new Event('pagehide'));
    expect(synth.cancels).toBe(1);

    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(synth.cancels).toBe(2);
    vis.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(synth.cancels).toBe(2);

    off();
    window.dispatchEvent(new Event('pagehide'));
    expect(synth.cancels).toBe(2);
    vis.mockRestore();
  });
});
