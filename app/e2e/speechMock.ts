/**
 * Web Speech API 목 (page.addInitScript로 주입).
 * 앱 계약(app/src/speech/stt.ts·tts.ts)에 맞춥니다.
 * - STT: window.SpeechRecognition ?? window.webkitSpeechRecognition 을 생성자로 찾고,
 *   onstart → listening, onspeechend → processing, onresult({results:[[{transcript}]]}) → result,
 *   onerror({error}) → mapRecognitionError, onend(결과 없이) → aborted/no-speech, 무응답 → 8초 timeout.
 * - TTS: speechSynthesis.getVoices()에 ko-KR 음성 1개, speak()는 50ms 뒤 onend.
 */
import type { Page } from '@playwright/test';

export type SttMode = 'success' | 'unsupported' | 'denied' | 'no-speech' | 'timeout';

export type SpeechMockOptions = { stt: SttMode; transcript?: string };

export async function installSpeechMock(page: Page, opts: SpeechMockOptions): Promise<void> {
  await page.addInitScript((o: SpeechMockOptions) => {
    const w = window as unknown as Record<string, unknown>;
    const log: string[] = [];
    w.__speechLog = log;

    // ---------- TTS ----------
    const voice = {
      voiceURI: 'mock-ko',
      name: 'Mock Korean',
      lang: 'ko-KR',
      localService: true,
      default: true,
    };
    class FakeUtterance {
      text: string;
      lang = '';
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    let speaking: FakeUtterance | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => [voice],
      speak(u: FakeUtterance) {
        log.push(`tts:${u.text}@${u.rate}`);
        speaking = u;
        this.speaking = true;
        timer = setTimeout(() => {
          this.speaking = false;
          const cur = speaking;
          speaking = null;
          cur?.onend?.();
        }, 50);
      },
      cancel() {
        if (timer) clearTimeout(timer);
        timer = null;
        speaking = null;
        this.speaking = false;
      },
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: FakeUtterance,
    });

    // ---------- STT ----------
    if (o.stt === 'unsupported') {
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        configurable: true,
        value: undefined,
      });
      return;
    }

    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onspeechend: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        log.push(`stt:start:${o.stt}:${this.lang}`);
        const later = (fn: () => void, ms: number) => setTimeout(fn, ms);
        switch (o.stt) {
          case 'success':
            later(() => this.onstart?.(), 30);
            later(() => this.onspeechend?.(), 80);
            later(() => {
              this.onresult?.({ results: [[{ transcript: o.transcript ?? '' }]] });
              this.onend?.();
            }, 130);
            break;
          case 'denied':
            later(() => {
              this.onerror?.({ error: 'not-allowed' });
              this.onend?.();
            }, 30);
            break;
          case 'no-speech':
            later(() => this.onstart?.(), 30);
            later(() => {
              this.onerror?.({ error: 'no-speech' });
              this.onend?.();
            }, 100);
            break;
          case 'timeout':
            // 듣기 시작 후 아무 이벤트도 오지 않음 → 앱의 listening 8초 기한
            later(() => this.onstart?.(), 30);
            break;
        }
      }
      abort() {
        log.push('stt:abort');
      }
      stop() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: FakeRecognition,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: FakeRecognition,
    });
  }, opts);
}
