/**
 * 다국어 사전 (T1.2, PRD F-01·1.3 '언어 전환').
 * - en.json이 키 집합의 기준입니다. ja·zh는 같은 키 집합을 가져야 합니다(index.test.ts).
 * - 값의 `{name}` 자리표시자는 t()의 params로 채웁니다.
 * - 한국어 고정 문구는 사전에 두지 않습니다: 학습 문장·메뉴명은 data JSON,
 *   직원 화면은 staffKo.ts, S13 운영자 리포트는 operatorKo.ts.
 */
import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { L10n, Lang } from '../types';
import en from './en.json';
import ja from './ja.json';
import zh from './zh.json';
import { devWarn, fillTemplate, type Params } from './format';

export { placeholders, type Params } from './format';

export type Dict = typeof en;

/** 중첩 객체의 잎(문자열) 경로: 'home.hi' 등 */
type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];

export type MessageKey = LeafPaths<Dict>;

// ja·zh가 en의 키를 모두 갖는지 컴파일 단계에서도 확인합니다(추가 키는 테스트가 잡음).
const jaDict: Dict = ja;
const zhDict: Dict = zh;

export const DICTS: Readonly<Record<Lang, Dict>> = { en, ja: jaDict, zh: zhDict };

/** 언어를 아직 고르지 않았을 때(store lang === null) 쓰는 언어 */
export const DEFAULT_LANG: Lang = 'en';

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * 순수 번역 함수. 키가 없으면 키 문자열을 그대로 돌려주고 개발 모드에서 경고합니다.
 * 다른 언어(영어)로 대신 채우지 않습니다. params를 생략해도 자리표시자가 있으면 경고합니다.
 */
export function t(lang: Lang, key: MessageKey, params?: Params): string {
  const value = lookup(DICTS[lang], key);
  if (value === undefined) {
    devWarn(`missing key "${key}" for "${lang}"`);
    return key;
  }
  return fillTemplate(value, params, `key "${key}"`);
}

/** L10n 콘텐츠(data JSON)에서 현재 언어 값을 꺼냅니다. */
export function pickL10n(lang: Lang, value: L10n): string {
  return value[lang];
}

/** store의 lang (미선택이면 DEFAULT_LANG) */
export function useLang(): Lang {
  return useAppStore((s) => s.lang) ?? DEFAULT_LANG;
}

/** 컴포넌트용 번역 함수. lang이 바뀌면 다시 렌더됩니다. */
export function useT(): (key: MessageKey, params?: Params) => string {
  const lang = useLang();
  return useCallback((key: MessageKey, params?: Params) => t(lang, key, params), [lang]);
}
