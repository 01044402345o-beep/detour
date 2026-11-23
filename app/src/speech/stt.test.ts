import type { SttState } from '../types';
import {
  STT_REQUEST_TIMEOUT_MS,
  STT_TIMEOUT_MS,
  createStt,
  findRecognition,
  mapRecognitionError,
  type Recognition,
  type RecognitionCtor,
} from './stt';

/** Web Speech API SpeechRecognition 목 */
class MockRecognition implements Recognition {
  static instances: MockRecognition[] = [];
  static throwOnStart = false;
  lang = '';
  continuous = true;
  interimResults = true;
  maxAlternatives = 5;
  onstart: Recognition['onstart'] = null;
  onspeechend: Recognition['onspeechend'] = null;
  onresult: Recognition['onresult'] = null;
  onerror: Recognition['onerror'] = null;
  onend: Recognition['onend'] = null;
  started = 0;
  aborted = 0;
  constructor() {
    MockRecognition.instances.push(this);
  }
  start() {
    if (MockRecognition.throwOnStart) throw new Error('InvalidStateError');
    this.started++;
  }
  abort() {
    this.aborted++;
  }
  // 브라우저 이벤트 흉내
  fireStart() {
    this.onstart?.();
  }
  fireSpeechEnd() {
    this.onspeechend?.();
  }
  fireResult(transcript: string) {
    this.onresult?.({ results: [[{ transcript }]] });
  }
  fireError(error: string) {
    this.onerror?.({ error });
  }
  fireEnd() {
    this.onend?.();
  }
}

const last = () => MockRecognition.instances[MockRecognition.instances.length - 1];

function setup(Recognition: RecognitionCtor | null = MockRecognition) {
  const states: SttState[] = [];
  const onShowStaff = vi.fn();
  const stt = createStt({ Recognition, onShowStaff, onState: (s) => states.push(s) });
  return { stt, states, onShowStaff, trail: () => states.map((s) => s.status) };
}

beforeEach(() => {
  MockRecognition.instances = [];
  MockRecognition.throwOnStart = false;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('stt 상태 머신 — 정상 경로', () => {
  it('idle → requesting → listening → processing → result', () => {
    const { stt, trail } = setup();
    expect(stt.getState()).toEqual({ status: 'idle' });

    stt.start();
    const r = last();
    expect(r.started).toBe(1);
    expect(r.lang).toBe('ko-KR');
    expect(r.continuous).toBe(false);
    expect(r.interimResults).toBe(false);
    expect(r.maxAlternatives).toBe(1);

    r.fireStart();
    r.fireSpeechEnd();
    r.fireResult('  김치찌개 하나 주세요 ');
    expect(trail()).toEqual(['requesting', 'listening', 'processing', 'result']);
    expect(stt.getState()).toEqual({ status: 'result', transcript: '김치찌개 하나 주세요' });
  });

  it('speechend 없이 바로 result가 와도 결과로 끝난다', () => {
    const { stt, trail } = setup();
    stt.start();
    last().fireStart();
    last().fireResult('네');
    expect(trail()).toEqual(['requesting', 'listening', 'result']);
  });

  it('result 뒤 늦게 오는 onend는 무시한다', () => {
    const { stt } = setup();
    stt.start();
    const r = last();
    r.fireStart();
    r.fireResult('네');
    r.fireEnd();
    expect(stt.getState().status).toBe('result');
  });

  it('reset은 인식 원문을 지우고 idle로', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    last().fireResult('네');
    stt.reset();
    expect(stt.getState()).toEqual({ status: 'idle' });
  });

  it('진행 중 start는 무시한다', () => {
    const { stt } = setup();
    stt.start();
    stt.start();
    last().fireStart();
    stt.start();
    expect(MockRecognition.instances).toHaveLength(1);
  });

  it('인식 원문을 콘솔에 남기지 않는다', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation(() => {}),
    );
    const { stt } = setup();
    stt.start();
    last().fireStart();
    last().fireResult('비밀 문장');
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    spies.forEach((s) => s.mockRestore());
  });
});

describe('stt 상태 머신 — 미지원', () => {
  it('API가 없으면 unsupported, showStaff만 제공', () => {
    const { stt, onShowStaff } = setup(null);
    const s = stt.getState();
    expect(s.status).toBe('unsupported');
    if (s.status !== 'unsupported') throw new Error('unreachable');
    expect(Object.keys(s.actions)).toEqual(['showStaff']);
    s.actions.showStaff();
    expect(onShowStaff).toHaveBeenCalledTimes(1);
  });

  it('unsupported에서 start·reset은 아무것도 하지 않는다', () => {
    const { stt, states } = setup(null);
    stt.start();
    stt.reset();
    expect(states).toEqual([]);
    expect(stt.getState().status).toBe('unsupported');
  });

  it('findRecognition: 표준·webkit 접두사·없음', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    expect(findRecognition()).toBeNull();
    vi.stubGlobal('webkitSpeechRecognition', MockRecognition);
    expect(findRecognition()).toBe(MockRecognition);
    class Std extends MockRecognition {}
    vi.stubGlobal('SpeechRecognition', Std);
    expect(findRecognition()).toBe(Std);
  });

  it('Recognition 미지정 시 window에서 찾는다', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    expect(createStt({ onShowStaff: () => {} }).getState().status).toBe('unsupported');
    vi.stubGlobal('webkitSpeechRecognition', MockRecognition);
    expect(createStt({ onShowStaff: () => {} }).getState().status).toBe('idle');
  });
});

describe('stt 상태 머신 — 실패 상태', () => {
  const errorCases: [string, 'requesting' | 'listening', string][] = [
    ['not-allowed', 'requesting', 'denied'],
    ['service-not-allowed', 'requesting', 'denied'],
    ['no-speech', 'listening', 'no-speech'],
    ['network', 'listening', 'network'],
    ['aborted', 'listening', 'aborted'],
    ['audio-capture', 'listening', 'error'],
    ['language-not-supported', 'requesting', 'error'],
  ];

  it.each(errorCases)('오류 %s (%s 중) → %s, retry·showStaff 제공', (code, at, expected) => {
    const { stt, onShowStaff } = setup();
    stt.start();
    const r = last();
    if (at === 'listening') r.fireStart();
    r.fireError(code);
    const s = stt.getState();
    expect(s.status).toBe(expected);
    if (!('actions' in s) || s.status === 'unsupported') throw new Error('unreachable');
    expect(Object.keys(s.actions).sort()).toEqual(['retry', 'showStaff']);
    expect(r.aborted).toBeGreaterThan(0);

    s.actions.showStaff();
    expect(onShowStaff).toHaveBeenCalledTimes(1);

    s.actions.retry();
    expect(stt.getState().status).toBe('requesting');
    expect(MockRecognition.instances).toHaveLength(2);
  });

  it('processing 중 오류도 실패로', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    last().fireSpeechEnd();
    last().fireError('network');
    expect(stt.getState().status).toBe('network');
  });

  it('빈 결과는 no-speech', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    last().fireResult('   ');
    expect(stt.getState().status).toBe('no-speech');
  });

  it('결과 없이 끝나면: 듣는 중 → no-speech, 권한 단계 → aborted', () => {
    const a = setup();
    a.stt.start();
    last().fireStart();
    last().fireEnd();
    expect(a.stt.getState().status).toBe('no-speech');

    const b = setup();
    b.stt.start();
    last().fireEnd();
    expect(b.stt.getState().status).toBe('aborted');
  });

  it('start()가 예외를 던지면 error', () => {
    MockRecognition.throwOnStart = true;
    const { stt, trail } = setup();
    stt.start();
    expect(trail()).toEqual(['requesting', 'error']);
  });

  it('사용자 취소 → aborted, 이후 이벤트 무시', () => {
    const { stt } = setup();
    stt.start();
    const r = last();
    r.fireStart();
    stt.cancel();
    expect(stt.getState().status).toBe('aborted');
    expect(r.aborted).toBe(1);
    r.fireResult('늦은 결과');
    r.fireError('aborted');
    expect(stt.getState().status).toBe('aborted');
  });

  it('cancel은 진행 중이 아니면 무시', () => {
    const { stt, states } = setup();
    stt.cancel();
    expect(states).toEqual([]);
  });

  it('retry 후 지난 시도의 늦은 이벤트는 무시한다', () => {
    const { stt } = setup();
    stt.start();
    const old = last();
    old.fireStart();
    old.fireError('network');
    const s = stt.getState();
    if (s.status !== 'network') throw new Error('unreachable');
    s.actions.retry();
    old.fireResult('옛 결과');
    old.fireEnd();
    expect(stt.getState().status).toBe('requesting');
    last().fireStart();
    last().fireResult('새 결과');
    expect(stt.getState()).toEqual({ status: 'result', transcript: '새 결과' });
  });

  it('result 상태에서 다시 start할 수 있다', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    last().fireResult('네');
    stt.start();
    expect(stt.getState().status).toBe('requesting');
  });

  it('mapRecognitionError: 알 수 없는 코드는 error', () => {
    expect(mapRecognitionError('bad-grammar')).toBe('error');
    expect(mapRecognitionError('')).toBe('error');
  });
});

describe('stt 타임아웃 (가짜 타이머)', () => {
  beforeEach(() => vi.useFakeTimers());

  it('기본 타임아웃은 8초', () => {
    expect(STT_TIMEOUT_MS).toBe(8000);
  });

  it('listening 후 8초 안에 결과가 없으면 timeout', () => {
    const { stt } = setup();
    stt.start();
    const r = last();
    r.fireStart();
    vi.advanceTimersByTime(7999);
    expect(stt.getState().status).toBe('listening');
    vi.advanceTimersByTime(1);
    const s = stt.getState();
    expect(s.status).toBe('timeout');
    if (s.status !== 'timeout') throw new Error('unreachable');
    expect(Object.keys(s.actions).sort()).toEqual(['retry', 'showStaff']);
    expect(r.aborted).toBe(1);
    // 타임아웃 뒤 늦은 결과는 무시
    r.fireResult('늦음');
    expect(stt.getState().status).toBe('timeout');
  });

  it('processing 진입 시 8초를 다시 잰다', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    vi.advanceTimersByTime(5000);
    last().fireSpeechEnd();
    vi.advanceTimersByTime(7999);
    expect(stt.getState().status).toBe('processing');
    vi.advanceTimersByTime(1);
    expect(stt.getState().status).toBe('timeout');
  });

  it('requesting은 15초 기한, 넘기면 timeout + retry·showStaff', () => {
    expect(STT_REQUEST_TIMEOUT_MS).toBe(15000);
    const { stt } = setup();
    stt.start();
    const r = last();
    vi.advanceTimersByTime(14_999);
    expect(stt.getState().status).toBe('requesting');
    vi.advanceTimersByTime(1);
    const s = stt.getState();
    expect(s.status).toBe('timeout');
    if (s.status !== 'timeout') throw new Error('unreachable');
    expect(Object.keys(s.actions).sort()).toEqual(['retry', 'showStaff']);
    expect(r.aborted).toBe(1);
  });

  it('requesting 기한 전에 onstart 오면 listening 8초로 다시 잰다', () => {
    const { stt } = setup();
    stt.start();
    vi.advanceTimersByTime(14_000);
    last().fireStart();
    vi.advanceTimersByTime(7999);
    expect(stt.getState().status).toBe('listening');
    vi.advanceTimersByTime(1);
    expect(stt.getState().status).toBe('timeout');
  });

  it('requesting 중 cancel·dispose하면 타이머가 남지 않는다', () => {
    const a = setup();
    a.stt.start();
    a.stt.cancel();
    expect(vi.getTimerCount()).toBe(0);
    const b = setup();
    b.stt.start();
    b.stt.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('requestTimeoutMs·timeoutMs 주입', () => {
    const stt = createStt({
      Recognition: MockRecognition,
      onShowStaff: () => {},
      requestTimeoutMs: 100,
      timeoutMs: 50,
    });
    stt.start();
    vi.advanceTimersByTime(100);
    expect(stt.getState().status).toBe('timeout');
    stt.start();
    last().fireStart();
    vi.advanceTimersByTime(50);
    expect(stt.getState().status).toBe('timeout');
  });

  it('제때 결과가 오면 타이머가 해제된다', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    vi.advanceTimersByTime(3000);
    last().fireResult('네');
    vi.advanceTimersByTime(20_000);
    expect(stt.getState().status).toBe('result');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('timeout 후 retry하면 새 8초를 잰다', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    vi.advanceTimersByTime(8000);
    const s = stt.getState();
    if (s.status !== 'timeout') throw new Error('unreachable');
    s.actions.retry();
    last().fireStart();
    vi.advanceTimersByTime(7999);
    expect(stt.getState().status).toBe('listening');
    vi.advanceTimersByTime(1);
    expect(stt.getState().status).toBe('timeout');
  });

  it('dispose는 내부 인식 원문을 지운다', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    last().fireResult('비밀 문장');
    stt.dispose();
    expect(stt.getState()).toEqual({ status: 'idle' });
  });

  it('dispose 후에는 인식을 멈추고 상태 알림·타이머가 없다', () => {
    const { stt, states } = setup();
    stt.start();
    const r = last();
    r.fireStart();
    const n = states.length;
    stt.dispose();
    expect(r.aborted).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    r.fireResult('네');
    stt.start();
    expect(states).toHaveLength(n);
  });
});

describe('stt 재진입 — onState 안에서 정리 (가짜 타이머)', () => {
  beforeEach(() => vi.useFakeTimers());

  function reentrant(at: SttState['status'], action: 'dispose' | 'cancel' | 'reset') {
    const states: SttState[] = [];
    const ref: { stt?: ReturnType<typeof createStt> } = {};
    const stt = createStt({
      Recognition: MockRecognition,
      onShowStaff: () => {},
      onState: (s) => {
        states.push(s);
        if (s.status === at) ref.stt?.[action]();
      },
    });
    ref.stt = stt;
    return { stt, states };
  }

  it.each(['dispose', 'cancel', 'reset'] as const)(
    'requesting 알림에서 %s → 마이크를 켜지 않는다',
    (action) => {
      const { stt, states } = reentrant('requesting', action);
      stt.start();
      const r = last();
      expect(r.started).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      const expected = {
        dispose: ['requesting'],
        cancel: ['requesting', 'aborted'],
        reset: ['requesting', 'idle'],
      };
      expect(states.map((s) => s.status)).toEqual(expected[action]);
      if (action === 'cancel') expect(stt.getState().status).toBe('aborted');
    },
  );

  it.each([
    ['listening', 'dispose'],
    ['listening', 'cancel'],
    ['processing', 'dispose'],
    ['processing', 'cancel'],
  ] as const)('%s 알림에서 %s → 타이머가 남지 않는다', (at, action) => {
    const { stt } = reentrant(at, action);
    stt.start();
    last().fireStart();
    if (at === 'processing') last().fireSpeechEnd();
    expect(vi.getTimerCount()).toBe(0);
    if (action === 'cancel') expect(stt.getState().status).toBe('aborted');
  });
});

describe('stt 이벤트 순서 보강', () => {
  it('processing에서 결과 없이 onend → no-speech', () => {
    const { stt } = setup();
    stt.start();
    last().fireStart();
    last().fireSpeechEnd();
    last().fireEnd();
    expect(stt.getState().status).toBe('no-speech');
  });

  it('error 뒤 end가 와도 error 결과를 유지한다', () => {
    const { stt } = setup();
    stt.start();
    const r = last();
    const onend = r.onend;
    r.fireStart();
    r.fireError('network');
    onend?.(); // 핸들러가 해제되어도 캡처해 둔 것을 직접 호출
    expect(stt.getState().status).toBe('network');
  });

  it('세대 가드: retry 전에 캡처한 이전 핸들러는 새 시도에 영향이 없다', () => {
    const { stt } = setup();
    stt.start();
    const old = last();
    const h = {
      onstart: old.onstart,
      onspeechend: old.onspeechend,
      onresult: old.onresult,
      onerror: old.onerror,
      onend: old.onend,
    };
    old.fireStart();
    old.fireError('network');
    const s = stt.getState();
    if (s.status !== 'network') throw new Error('unreachable');
    s.actions.retry();
    expect(stt.getState().status).toBe('requesting');
    h.onstart?.();
    h.onspeechend?.();
    h.onresult?.({ results: [[{ transcript: '옛 결과' }]] });
    h.onerror?.({ error: 'aborted' });
    h.onend?.();
    expect(stt.getState().status).toBe('requesting');
    last().fireStart();
    last().fireResult('새 결과');
    expect(stt.getState()).toEqual({ status: 'result', transcript: '새 결과' });
  });
});
