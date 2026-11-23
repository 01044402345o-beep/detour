import { create } from 'zustand';
import type { Lang } from '../types';

/** lang 슬라이스 (공유 계약). persist·cart 등은 T1.6에서 확장합니다. */
export type LangSlice = {
  /** 첫 실행 전에는 null → 언어 선택 화면 (F-01) */
  lang: Lang | null;
  setLang: (lang: Lang) => void;
};

export type AppState = LangSlice;

export const useAppStore = create<AppState>()((set) => ({
  lang: null,
  setLang: (lang) => set({ lang }),
}));
