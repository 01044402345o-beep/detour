import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { UpdateToast } from '../sw/UpdateToast';
import { ToastContext, ToastDismissContext } from './toastContext';

/** 토스트 표시 시간 (목업 애니메이션 2.4초) */
export const TOAST_MS = 2400;

/**
 * 경로 변경으로 닫을 때, 이 시간 안에 띄운 토스트는 남김: 토스트를 띄운 동작이 곧바로 화면을 옮기는 경우
 * (예: 설정 > 데모 초기화 → 안내 토스트 + 언어 화면 이동) 그 안내가 다음 화면에서 보이게.
 * 화면 이동이 transition으로 늦게 반영될 수 있어 렌더 순서 대신 시간으로 판단합니다.
 */
export const TOAST_ROUTE_GRACE_MS = 500;

type ToastItem = { id: number; message: string };

/**
 * 토스트 제공자. 앱 틀(.app-frame) 안에 1개 둡니다(AppLayout) — 토스트가 폰 폭 안 아래쪽에 뜹니다.
 * 알림 영역(role=status)은 항상 그려 두어 화면 낭독기가 새 문구를 읽습니다.
 * 새 토스트가 오면 이전 것을 바로 바꿉니다.
 * 새 버전 업데이트 토스트(T3.1, sw/UpdateToast)도 같은 알림 영역 안에 그립니다 — 앱 시작 시 서비스 워커 등록 포함.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);

  const shownAt = useRef(0);

  const show = useCallback((message: string) => {
    shownAt.current = Date.now();
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
  }, []);

  /** 일반 토스트만 닫음 (방금 띄운 것은 남김). SW 업데이트 안내는 별도 상태라 영향 없음 */
  const dismiss = useCallback(() => {
    if (Date.now() - shownAt.current < TOAST_ROUTE_GRACE_MS) return;
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      <ToastDismissContext.Provider value={dismiss}>{children}</ToastDismissContext.Provider>
      <div role="status" aria-live="polite" data-testid="toast-region">
        {toast && (
          <div key={toast.id} className="ui-toast">
            {toast.message}
          </div>
        )}
        <UpdateToast />
      </div>
    </ToastContext.Provider>
  );
}
