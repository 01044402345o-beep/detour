import { createContext, useContext } from 'react';

export type ShowToast = (message: string) => void;

export const ToastContext = createContext<ShowToast | null>(null);

/** 토스트 띄우기: `const toast = useToast(); toast(t('common.comingSoon'))` */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}
