import { createContext, useContext } from 'react';

export type ShowToast = (message: string) => void;

export const ToastContext = createContext<ShowToast | null>(null);

/** 토스트 띄우기: `const toast = useToast(); toast(t('common.comingSoon'))` */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}

/** 일반 토스트 닫기 (경로가 바뀔 때 AppRoutes가 부름). SW 업데이트 안내(sw/UpdateToast)는 닫지 않음 */
export type DismissToast = () => void;

export const ToastDismissContext = createContext<DismissToast | null>(null);

/** 경로 이동 등으로 지난 화면의 일반 토스트를 닫을 때 */
export function useDismissToast(): DismissToast {
  const dismiss = useContext(ToastDismissContext);
  if (!dismiss) throw new Error('useDismissToast must be used inside <ToastProvider>');
  return dismiss;
}
