/**
 * T1.5 STT 어댑터 (PRD F-08). 브라우저 음성인식(ko-KR) 상태 머신.
 *
 * ```
 * idle → requesting(권한) → listening → processing → result
 *                 ↘ denied      ↘ no-speech / timeout(8초) / network / aborted / error
 * unsupported (API 없음)
 * ```
 * - 실패 상태는 `{ retry, showStaff }`, `unsupported`는 `{ showStaff }`만 넘깁니다.
 * - 타임아웃(단계별, 넘기면 'timeout'):
 *   requesting 15초(권한 팝업·서비스 시작 대기) / listening 8초 / processing 8초.
 *   실제 기기의 권한~onstart 소요는 T4.3에서 실측합니다.
 * - 상태 알림(onState) 안에서 cancel·reset·dispose를 불러도 안전합니다(재진입 가드).
 * - 인식 원문은 'result' 상태로만 돌려주고 저장·로그하지 않습니다.
 */
import type { SttFailureReason, SttState } from '../types';

export const STT_TIMEOUT_MS = 8000;
/** requesting(권한·서비스 시작) 기한. 권한 팝업을 8초로 끊지 않도록 더 길게 둡니다. */
export const STT_REQUEST_TIMEOUT_MS = 15000;

// lib.dom의 Web Speech 타입은 브라우저마다 접두사가 달라 최소 계약만 정의합니다.
export type RecognitionErrorEvent = { error: string };
export type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

export type RecognitionCtor = new () => Recognition;

export type SttOptions = {
  /** 상태가 바뀔 때마다 호출 */
  onState?: (s: SttState) => void;
  /** '직원에게 보여주기' 선택 */
  onShowStaff: () => void;
  /** 미지정 시 window.SpeechRecognition ?? window.webkitSpeechRecognition */
  Recognition?: RecognitionCtor | null;
  /** listening·processing 단계 기한 (기본 8초) */
  timeoutMs?: number;
  /** requesting 단계 기한 (기본 15초) */
  requestTimeoutMs?: number;
};

export type Stt = {
  getState(): SttState;
  /** idle·result·실패 상태에서 인식을 시작합니다. 진행 중이거나 미지원이면 무시 */
  start(): void;
  /** 사용자 취소 → 'aborted' (F-08: 취소도 실패) */
  cancel(): void;
  /** 결과(인식 원문)를 지우고 idle로 */
  reset(): void;
  /** 화면 이탈: 인식 중단, 내부 원문 삭제, 이후 상태 알림 없음 */
  dispose(): void;
};

export function findRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 브라우저 오류 코드 → 실패 상태 */
export function mapRecognitionError(code: string): SttFailureReason {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'no-speech':
      return 'no-speech';
    case 'network':
      return 'network';
    case 'aborted':
      return 'aborted';
    default:
      return 'error';
  }
}

const ACTIVE = new Set<SttState['status']>(['requesting', 'listening', 'processing']);

export function createStt(opts: SttOptions): Stt {
  const Ctor = opts.Recognition === undefined ? findRecognition() : opts.Recognition;
  const timeoutMs = opts.timeoutMs ?? STT_TIMEOUT_MS;
  const requestTimeoutMs = opts.requestTimeoutMs ?? STT_REQUEST_TIMEOUT_MS;
  const showStaff = () => opts.onShowStaff();

  let disposed = false;
  let rec: Recognition | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** 시도마다 증가. 지난 시도의 늦은 이벤트를 버립니다. */
  let attempt = 0;

  let state: SttState = Ctor
    ? { status: 'idle' }
    : { status: 'unsupported', actions: { showStaff } };

  function set(next: SttState) {
    state = next;
    if (!disposed) opts.onState?.(next);
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function detach() {
    clearTimer();
    if (rec) {
      rec.onstart = rec.onspeechend = rec.onresult = rec.onerror = rec.onend = null;
      try {
        rec.abort();
      } catch {
        // 이미 끝난 인식
      }
      rec = null;
    }
  }

  function fail(reason: SttFailureReason) {
    detach();
    set({ status: reason, actions: { retry: start, showStaff } });
  }

  function armTimer(id: number, ms: number) {
    clearTimer();
    timer = setTimeout(() => {
      if (id === attempt) fail('timeout');
    }, ms);
  }

  function start() {
    if (disposed || !Ctor || ACTIVE.has(state.status)) return;
    detach();
    const id = ++attempt;
    const r = new Ctor();
    rec = r;
    r.lang = 'ko-KR';
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    const live = () => id === attempt && rec === r;

    r.onstart = () => {
      if (!live() || state.status !== 'requesting') return;
      // 타이머를 먼저 두어 알림 안의 cancel·dispose가 마지막 정리가 되게 합니다
      armTimer(id, timeoutMs);
      set({ status: 'listening' });
    };
    r.onspeechend = () => {
      if (!live() || state.status !== 'listening') return;
      armTimer(id, timeoutMs);
      set({ status: 'processing' });
    };
    r.onresult = (e) => {
      if (!live()) return;
      const transcript = (e.results[0]?.[0]?.transcript ?? '').trim();
      detach();
      if (!transcript) {
        set({ status: 'no-speech', actions: { retry: start, showStaff } });
        return;
      }
      set({ status: 'result', transcript });
    };
    r.onerror = (e) => {
      if (!live()) return;
      fail(mapRecognitionError(e.error));
    };
    r.onend = () => {
      if (!live()) return;
      // 결과·오류 없이 끝남: 권한 단계면 취소, 듣는 중이면 무음
      fail(state.status === 'requesting' ? 'aborted' : 'no-speech');
    };

    set({ status: 'requesting' });
    // 알림 안에서 cancel·dispose·reset되었으면 마이크를 켜지 않습니다
    if (disposed || !live()) return;
    armTimer(id, requestTimeoutMs);
    try {
      r.start();
    } catch {
      if (live()) fail('error');
    }
  }

  function cancel() {
    if (!ACTIVE.has(state.status)) return;
    attempt++;
    fail('aborted');
  }

  function reset() {
    if (disposed || !Ctor) return;
    attempt++;
    detach();
    set({ status: 'idle' });
  }

  function dispose() {
    attempt++;
    detach();
    disposed = true;
    // 인식 원문이 남지 않게 비웁니다 (알림 없음)
    if (Ctor) state = { status: 'idle' };
  }

  return { getState: () => state, start, cancel, reset, dispose };
}
