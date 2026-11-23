import { useEffect } from 'react';

type WakeLockLike = { released: boolean; release: () => Promise<void> };
type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockLike> };

function wakeLockApi(): WakeLockApi | null {
  const nav = navigator as Navigator & { wakeLock?: WakeLockApi };
  return nav.wakeLock && typeof nav.wakeLock.request === 'function' ? nav.wakeLock : null;
}

/**
 * 화면 켜짐 유지 (T2.5, Screen Wake Lock API). 미지원·거부·오류는 조용히 무시합니다.
 * 탭이 가려지면 브라우저가 잠금을 풀므로, 다시 보일 때 새로 요청합니다.
 * 언마운트(화면 이탈) 시 해제합니다.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const api = active ? wakeLockApi() : null;
    if (!api) return;
    let disposed = false;
    let sentinel: WakeLockLike | null = null;
    let pending = false;

    const release = (s: WakeLockLike | null) => {
      if (!s || s.released) return;
      s.release().catch(() => {});
    };
    const request = () => {
      if (disposed || pending || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      pending = true;
      let p: Promise<WakeLockLike>;
      try {
        p = api.request('screen');
      } catch {
        pending = false;
        return;
      }
      p.then(
        (s) => {
          pending = false;
          if (disposed) release(s);
          else sentinel = s;
        },
        () => {
          pending = false;
        },
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release(sentinel);
      sentinel = null;
    };
  }, [active]);
}
