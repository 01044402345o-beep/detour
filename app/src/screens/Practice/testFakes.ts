/**
 * T2.4 테스트 전용 가짜 음성 모듈 (앱 코드에서 import하지 않습니다).
 * - FakeRecognition: speech/stt가 쓰는 Recognition 계약을 따르고, 테스트가 이벤트를 직접 일으킵니다.
 * - fakeTts: T1.5 onEnd 계약(선점·cancel 시 이전 onEnd 1회)을 따르는 TTS.
 */
import { vi } from 'vitest';
import type { Recognition, RecognitionCtor } from '../../speech/stt';
import type { SpeakResult, Tts, TtsRate } from '../../speech/tts';
import type { TtsState } from '../../types';

export type FakeRec = Recognition & {
  started: boolean;
  aborted: boolean;
  emitStart(): void;
  emitSpeechEnd(): void;
  emitResult(transcript: string): void;
  emitError(code: string): void;
  emitEnd(): void;
};

export function fakeRecognition(): {
  Ctor: RecognitionCtor;
  instances: FakeRec[];
  last(): FakeRec;
} {
  const instances: FakeRec[] = [];
  class Rec implements FakeRec {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onstart: (() => void) | null = null;
    onspeechend: (() => void) | null = null;
    onresult: Recognition['onresult'] = null;
    onerror: Recognition['onerror'] = null;
    onend: (() => void) | null = null;
    started = false;
    aborted = false;
    constructor() {
      instances.push(this);
    }
    start() {
      this.started = true;
    }
    abort() {
      this.aborted = true;
    }
    emitStart() {
      this.onstart?.();
    }
    emitSpeechEnd() {
      this.onspeechend?.();
    }
    emitResult(transcript: string) {
      this.onresult?.({ results: [[{ transcript }]] });
    }
    emitError(code: string) {
      this.onerror?.({ error: code });
    }
    emitEnd() {
      this.onend?.();
    }
  }
  return {
    Ctor: Rec,
    instances,
    last: () => {
      const r = instances[instances.length - 1];
      if (!r) throw new Error('no recognition instance');
      return r;
    },
  };
}

export function fakeTts(state: TtsState = 'ready') {
  let current: (() => void) | null = null;
  const tts = {
    init: vi.fn(async () => state),
    getState: vi.fn(() => state),
    speak: vi.fn((_text: string, _rate?: TtsRate, onEnd?: () => void): SpeakResult => {
      const prev = current;
      current = onEnd ?? null;
      prev?.();
      return 'started';
    }),
    cancel: vi.fn(() => {
      const c = current;
      current = null;
      c?.();
    }),
    bindAutoCancel: vi.fn(() => () => {}),
  } satisfies Tts;
  return tts;
}
