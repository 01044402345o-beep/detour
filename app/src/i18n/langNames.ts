import type { Lang } from '../types';

/**
 * 언어 선택·설정 화면의 언어 이름. 각 언어의 자기 이름(endonym)이라 화면 언어와 관계없이 고정입니다.
 * 하드코딩 검사 예외 목록(hardcodeCheck.ts)에 들어 있습니다.
 */
export const LANG_NAMES: Readonly<Record<Lang, { name: string; badge: string }>> = {
  en: { name: 'English', badge: 'EN' },
  ja: { name: '日本語', badge: 'JA' },
  zh: { name: '简体中文', badge: '中' },
};
