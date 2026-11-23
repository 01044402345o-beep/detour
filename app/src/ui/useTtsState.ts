import { useEffect, useState } from 'react';
import { getTts, type Tts } from '../speech/tts';
import type { TtsState } from '../types';

/**
 * TTS 계약 ① (T1.5 R2·R3): 마운트 시 `tts.init()`을 부르고, 끝나면 `getState()`로 상태를 갱신합니다.
 * 언마운트 뒤 도착한 결과는 무시합니다. null = 음성 탐색 중.
 * `refresh()`는 speak() 직후처럼 상태가 바뀌었을 수 있을 때 동기로 다시 읽습니다.
 */
export function useTtsState(tts: Tts = getTts()): { state: TtsState | null; refresh: () => void } {
  const [state, setState] = useState<TtsState | null>(() => tts.getState());

  useEffect(() => {
    let alive = true;
    tts.init().then(
      () => {
        if (alive) setState(tts.getState());
      },
      () => {
        if (alive) setState(tts.getState());
      },
    );
    return () => {
      alive = false;
    };
  }, [tts]);

  return { state, refresh: () => setState(tts.getState()) };
}
