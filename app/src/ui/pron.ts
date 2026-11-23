import type { Lang } from '../types';

/** 언어별 발음 표기 종류 (F-01): EN·ZH = 로마자(개정 로마자 기반, 병음 아님), JA = 가타카나 */
export function pronunciationKind(lang: Lang): 'roman' | 'kana' {
  return lang === 'ja' ? 'kana' : 'roman';
}

/** 발음 표기 문자열 고르기 (문자열이 필요한 곳용. 화면 표시는 <Pronunciation>) */
export function pickPronunciation(lang: Lang, p: { roman: string; kana: string }): string {
  return pronunciationKind(lang) === 'kana' ? p.kana : p.roman;
}
