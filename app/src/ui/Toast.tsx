import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { UpdateToast } from '../sw/UpdateToast';
import { ToastContext } from './toastContext';

/** 토스트 표시 시간 (목업 애니메이션 2.4초) */
export const TOAST_MS = 2400;

type ToastItem = { id: number; message: string };

/**
 * 토스트 제공자. 앱 틀(.app-frame) 안에 1개 둡니다(AppLayout) — 토스트가 폰 폭 안 아래쪽에 뜹니다.
 * 알림 영역(role=status)은 항상 그려 두어 화면 낭독기가 새 문구를 읽습니다.
 * 새 토스트가 오면 이전 것을 바로 바꿉니다.
 * 새 버전 업데이트 토스트(T3.1, sw/UpdateToast)도 같은 알림 영역 안에 그립니다 — 앱 시작 시 서비스 워커 등록 포함.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);

  const show = useCallback((message: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
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
