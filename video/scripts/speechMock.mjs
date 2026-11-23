/**
 * 녹화용 Web Speech API 목 + 탭 표시.
 * 앱 계약은 app/e2e/speechMock.ts(Phase 2 E2E)와 같고, 화면에 상태가 보이도록 시간만 늘렸습니다.
 * - STT: onstart → (listenMs) onspeechend → onresult(transcript) → onend
 *   실제 마이크·음성 인식을 쓰지 않으므로 이 장면은 영상에서 '재현 장면'으로 표시합니다.
 * - TTS: ko-KR 음성 1개, speak()는 speakMs 뒤 onend (소리는 나지 않음)
 * - 탭 표시: 녹화 화면에 손가락 위치 원을 그립니다(앱 소스 변경 없음, 녹화 페이지에만 주입).
 */

/** @param {import('playwright-core').BrowserContext} context */
export async function installSpeechMock(context, { transcript, listenMs = 2500, speakMs = 2000 }) {
  await context.addInitScript(
    ({ transcript, listenMs, speakMs }) => {
      const voice = { voiceURI: 'mock-ko', name: 'Mock Korean', lang: 'ko-KR', localService: true, default: true };
      class FakeUtterance {
        constructor(text) {
          this.text = text;
          this.lang = '';
          this.rate = 1;
          this.voice = null;
          this.onend = null;
          this.onerror = null;
        }
      }
      let timer = null;
      let speaking = null;
      const synth = {
        speaking: false,
        pending: false,
        paused: false,
        onvoiceschanged: null,
        getVoices: () => [voice],
        speak(u) {
          speaking = u;
          this.speaking = true;
          timer = setTimeout(() => {
            this.speaking = false;
            const cur = speaking;
            speaking = null;
            cur?.onend?.();
          }, speakMs);
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
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });

      class FakeRecognition {
        constructor() {
          this.lang = '';
          this.continuous = false;
          this.interimResults = false;
          this.maxAlternatives = 1;
          this.onstart = this.onspeechend = this.onresult = this.onerror = this.onend = null;
        }
        start() {
          setTimeout(() => this.onstart?.(), 60);
          setTimeout(() => this.onspeechend?.(), 60 + listenMs);
          setTimeout(() => {
            this.onresult?.({ results: [[{ transcript }]] });
            this.onend?.();
          }, 60 + listenMs + 700);
        }
        abort() {}
        stop() {}
      }
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
      Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition });
    },
    { transcript, listenMs, speakMs },
  );
}

/** @param {import('playwright-core').BrowserContext} context */
export async function installTapIndicator(context) {
  await context.addInitScript(() => {
    const show = (x, y) => {
      const d = document.createElement('div');
      d.setAttribute('aria-hidden', 'true');
      Object.assign(d.style, {
        position: 'fixed',
        left: `${x - 22}px`,
        top: `${y - 22}px`,
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.45)',
        border: '3px solid rgba(20,20,20,0.55)',
        pointerEvents: 'none',
        zIndex: '2147483647',
        transition: 'transform 450ms ease-out, opacity 450ms ease-out',
      });
      document.documentElement.appendChild(d);
      requestAnimationFrame(() => {
        d.style.transform = 'scale(1.5)';
        d.style.opacity = '0';
      });
      setTimeout(() => d.remove(), 600);
    };
    window.addEventListener('pointerdown', (e) => show(e.clientX, e.clientY), true);
  });
}
