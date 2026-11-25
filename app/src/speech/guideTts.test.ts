import type { TtsEnv } from './tts';
import { GUIDE_LOCALE, createGuideTts, pickGuideVoice } from './guideTts';

type Voice = Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'localService'>;

class MockUtterance {
  lang = '';
  rate = 1;
  voice: Voice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

/** speechSynthesis 목: 큐에 쌓고, 크롬처럼 cancel 시 'interrupted'를 비동기로 보냄 */
class MockSynth extends EventTarget {
  voices: Voice[] = [];
  queue: MockUtterance[] = [];
  spoken: MockUtterance[] = [];
  cancels = 0;
  resumes = 0;
  getVoices() {
    return this.voices as SpeechSynthesisVoice[];
  }
  speak(u: MockUtterance) {
    this.spoken.push(u);
    this.queue.push(u);
  }
  resume() {
    this.resumes++;
  }
  cancel() {
    this.cancels++;
    const dropped = this.queue;
    this.queue = [];
    queueMicrotask(() => dropped.forEach((u) => u.onerror?.({ error: 'interrupted' })));
  }
  /** 맨 앞 발화 시작 → 끝 */
  runFront() {
    const u = this.queue[0];
    u?.onstart?.();
    this.queue.shift();
    u?.onend?.();
  }
  setVoices(v: Voice[]) {
    this.voices = v;
    this.dispatchEvent(new Event('voiceschanged'));
  }
}

const V = (lang: string, name: string, localService = true): Voice => ({ lang, name, localService });

function env(synth: MockSynth, extra: Partial<TtsEnv> = {}): TtsEnv {
  return {
    synth: synth as unknown as SpeechSynthesis,
    Utterance: MockUtterance as unknown as typeof SpeechSynthesisUtterance,
    ...extra,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.useRealTimers());

describe('pickGuideVoice: 언어별 음성 고르기', () => {
  it('언어가 맞는 음성만, 없으면 null (한국어 음성으로 일본어를 읽지 않음)', () => {
    const voices = [V('ko-KR', 'Heami')];
    expect(pickGuideVoice(voices, 'ja')).toBeNull();
    expect(pickGuideVoice(voices, 'zh')).toBeNull();
    expect(pickGuideVoice(voices, 'en')).toBeNull();
  });

  it('영어: en-US 자연스러운 음성 > en-US > en-GB > 그 밖 영어', () => {
    const v = [V('en-IN', 'Ravi'), V('en-GB', 'Hazel'), V('en-US', 'David'), V('en-US', 'Aria Online (Natural)', false)];
    expect(pickGuideVoice(v, 'en')?.name).toBe('Aria Online (Natural)');
    expect(pickGuideVoice(v.slice(0, 3), 'en')?.name).toBe('David');
    expect(pickGuideVoice(v.slice(0, 2), 'en')?.name).toBe('Hazel');
    expect(pickGuideVoice([V('en_AU', 'Karen')], 'en')?.name).toBe('Karen'); // 밑줄 표기(안드로이드)
  });

  it('일본어: ja-JP, 자연스러운 음성 우선', () => {
    const v = [V('ja-JP', 'Haruka'), V('ja-JP', 'Google 日本語', false), V('en-US', 'David')];
    expect(pickGuideVoice(v, 'ja')?.name).toBe('Google 日本語');
    expect(pickGuideVoice([V('ja-JP', 'Kyoko')], 'ja')?.name).toBe('Kyoko');
  });

  it('중국어: 표준 중국어(zh-CN·cmn) > zh-TW > 광둥어(zh-HK·yue)', () => {
    const hk = V('zh-HK', 'Sin-ji');
    const tw = V('zh-TW', 'Mei-Jia');
    const cn = V('zh-CN', 'Tingting');
    expect(pickGuideVoice([hk, tw, cn], 'zh')?.name).toBe('Tingting');
    expect(pickGuideVoice([hk, tw], 'zh')?.name).toBe('Mei-Jia');
    expect(pickGuideVoice([hk], 'zh')?.name).toBe('Sin-ji');
    expect(pickGuideVoice([V('cmn-Hans-CN', 'Xiaoxiao')], 'zh')?.name).toBe('Xiaoxiao');
    expect(pickGuideVoice([V('zh_CN', 'Google 普通话')], 'zh')?.name).toBe('Google 普通话');
  });
});

describe('guideTts 상태·재생', () => {
  it('API가 없으면 unsupported', async () => {
    const g = createGuideTts({});
    expect(g.voiceState('ja')).toBe('unsupported');
    await expect(g.init('ja')).resolves.toBe('unsupported');
    expect(g.play(['a'], 'ja', 1, 0)).toBe('unsupported');
    expect(() => g.stop()).not.toThrow();
  });

  it('목록이 비면 null, 늦게 온 일본어 음성을 voiceschanged로 기다려 ready', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    const g = createGuideTts(env(synth));
    expect(g.voiceState('ja')).toBeNull();
    const p = g.init('ja');
    synth.setVoices([V('ja-JP', 'Kyoko')]);
    await expect(p).resolves.toBe('ready');
  });

  it('2초 기다려도 그 언어 음성이 없으면 no-voice', async () => {
    vi.useFakeTimers();
    const synth = new MockSynth();
    synth.voices = [V('ko-KR', 'Heami')];
    const g = createGuideTts(env(synth));
    const p = g.init('zh');
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toBe('no-voice');
  });

  it('문장마다 발화를 하나씩 큐에 넣음: 언어·음성·속도, from번부터', () => {
    const synth = new MockSynth();
    const kyoko = V('ja-JP', 'Kyoko');
    synth.voices = [V('ko-KR', 'Heami'), kyoko];
    const g = createGuideTts(env(synth));
    expect(g.play(['一。', '二。', '三。'], 'ja', 0.75, 1)).toBe('started');
    expect(synth.spoken.map((u) => u.text)).toEqual(['二。', '三。']);
    for (const u of synth.spoken) {
      expect(u.lang).toBe('ja-JP');
      expect(u.voice).toBe(kyoko);
      expect(u.rate).toBe(0.75);
    }
    expect(synth.resumes).toBe(1);
  });

  it('음성이 목록에 없어도 언어(lang)를 지정해 시도 (엔진이 언어로 읽는 기기)', () => {
    const synth = new MockSynth();
    synth.voices = [V('ko-KR', 'Heami')];
    const g = createGuideTts(env(synth));
    g.play(['你好。'], 'zh', 1, 0);
    expect(synth.spoken[0].lang).toBe(GUIDE_LOCALE.zh);
    expect(synth.spoken[0].voice).toBeNull();
  });

  it('문장 시작마다 onSentence(전체 순번), 마지막 문장이 끝나면 onEnd("done") 1회', () => {
    const synth = new MockSynth();
    synth.voices = [V('en-US', 'Sam')];
    const g = createGuideTts(env(synth));
    const onSentence = vi.fn();
    const onEnd = vi.fn();
    g.play(['A.', 'B.', 'C.'], 'en', 1, 0, { onSentence, onEnd });
    synth.runFront();
    synth.runFront();
    expect(onEnd).not.toHaveBeenCalled();
    synth.runFront();
    expect(onSentence.mock.calls).toEqual([[0], [1], [2]]);
    expect(onEnd.mock.calls).toEqual([['done']]);
  });

  it('stop(): 즉시 onEnd("stopped") 1회, 늦게 오는 interrupted는 무시', async () => {
    const synth = new MockSynth();
    synth.voices = [V('en-US', 'Sam')];
    const g = createGuideTts(env(synth));
    const onEnd = vi.fn();
    g.play(['A.', 'B.'], 'en', 1, 0, { onEnd });
    g.stop();
    expect(onEnd.mock.calls).toEqual([['stopped']]);
    await tick();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('새 play()는 이전 재생을 "stopped"로 끝내고 새 문장만 큐에', async () => {
    const synth = new MockSynth();
    synth.voices = [V('en-US', 'Sam')];
    const g = createGuideTts(env(synth));
    const first = vi.fn();
    const second = vi.fn();
    g.play(['A.'], 'en', 1, 0, { onEnd: first });
    g.play(['B.'], 'en', 1, 0, { onEnd: second });
    expect(first.mock.calls).toEqual([['stopped']]);
    await tick();
    expect(second).not.toHaveBeenCalled();
    expect(synth.queue.map((u) => u.text)).toEqual(['B.']);
  });

  it('다른 재생(한국어 문장 듣기)이 speechSynthesis를 끊으면 "stopped"로 마무리', async () => {
    const synth = new MockSynth();
    synth.voices = [V('en-US', 'Sam')];
    const g = createGuideTts(env(synth));
    const onEnd = vi.fn();
    g.play(['A.', 'B.'], 'en', 1, 0, { onEnd });
    synth.cancel(); // 바깥에서 끊음
    await tick();
    expect(onEnd.mock.calls).toEqual([['stopped']]);
  });

  it('진짜 오류는 onEnd("error")', () => {
    const synth = new MockSynth();
    synth.voices = [V('en-US', 'Sam')];
    const g = createGuideTts(env(synth));
    const onEnd = vi.fn();
    g.play(['A.'], 'en', 1, 0, { onEnd });
    synth.queue[0].onerror?.({ error: 'synthesis-failed' });
    expect(onEnd.mock.calls).toEqual([['error']]);
  });

  it('중간 문장 오류(R1 M-01): 남은 큐를 취소하고 onEnd("error") 1회, 늦은 취소 이벤트·다음 재생에 영향 없음', async () => {
    const synth = new MockSynth();
    synth.voices = [V('en-US', 'Sam')];
    const g = createGuideTts(env(synth));
    const onEnd = vi.fn();
    const onSentence = vi.fn();
    g.play(['A.', 'B.', 'C.'], 'en', 1, 0, { onEnd, onSentence });
    const [a] = synth.queue;
    a.onstart?.();
    a.onerror?.({ error: 'synthesis-failed' });
    expect(onEnd.mock.calls).toEqual([['error']]);
    expect(synth.queue).toHaveLength(0); // B·C가 몰래 계속 나오지 않음
    await tick();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onSentence.mock.calls).toEqual([[0]]);
    // 다음 재생은 정상
    const next = vi.fn();
    g.play(['D.'], 'en', 1, 0, { onEnd: next });
    await tick();
    synth.runFront();
    expect(next.mock.calls).toEqual([['done']]);
  });

  it('오류 알림(onEnd) 안에서 바로 새 재생을 시작해도 이전 오류 처리가 새 재생을 지우지 않음 (R2 L-01)', async () => {
    const synth = new MockSynth();
    synth.voices = [V('en-US', 'Sam')];
    const g = createGuideTts(env(synth));
    const second = vi.fn();
    g.play(['A.', 'B.'], 'en', 1, 0, {
      onEnd: (r) => {
        if (r === 'error') g.play(['C.'], 'en', 1, 0, { onEnd: second });
      },
    });
    synth.queue[0].onerror?.({ error: 'synthesis-failed' });
    expect(synth.queue.map((u) => u.text)).toEqual(['C.']);
    await tick();
    expect(second).not.toHaveBeenCalled();
    synth.runFront();
    expect(second.mock.calls).toEqual([['done']]);
  });

  it('실패한 음성은 다음 재생에서 피함(R1 M-02): 온라인 음성 실패 → 기기 내장 음성', () => {
    const synth = new MockSynth();
    const online = V('ja-JP', 'Google 日本語', false);
    const local = V('ja-JP', 'Kyoko', true);
    synth.voices = [local, online];
    const g = createGuideTts(env(synth));
    g.play(['一。'], 'ja', 1, 0);
    expect(synth.spoken[0].voice).toBe(online);
    synth.queue[0].onerror?.({ error: 'network' });
    g.play(['一。'], 'ja', 1, 0);
    expect(synth.spoken[1].voice).toBe(local);
  });

  it('오프라인이면 처음부터 기기 내장 음성 우선', () => {
    const online = V('zh-CN', 'Xiaoxiao Online (Natural)', false);
    const local = V('zh-CN', 'Tingting', true);
    expect(pickGuideVoice([online, local], 'zh')).toBe(online);
    expect(pickGuideVoice([online, local], 'zh', { offline: true })).toBe(local);
    expect(pickGuideVoice([online], 'zh', { offline: true })).toBe(online); // 내장이 없으면 그래도 시도
    expect(pickGuideVoice([online, local], 'zh', { avoid: new Set([online.name]) })).toBe(local);
  });

  it('사용자 탭 밖이면 not-user-gesture, 큐에 넣지 않음', () => {
    const synth = new MockSynth();
    const g = createGuideTts(env(synth, { userActivation: { isActive: false } }));
    expect(g.play(['A.'], 'en', 1, 0)).toBe('not-user-gesture');
    expect(synth.spoken).toHaveLength(0);
  });

  it('페이지가 숨겨지면 멈춤 (bindAutoCancel)', () => {
    const synth = new MockSynth();
    synth.voices = [V('en-US', 'Sam')];
    const g = createGuideTts(env(synth, { target: window, doc: document }));
    const off = g.bindAutoCancel();
    const onEnd = vi.fn();
    g.play(['A.'], 'en', 1, 0, { onEnd });
    window.dispatchEvent(new Event('pagehide'));
    expect(onEnd.mock.calls).toEqual([['stopped']]);
    off();
  });
});
