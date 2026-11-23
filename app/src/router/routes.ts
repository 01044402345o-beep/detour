/**
 * 라우트 표 (T2.0, PRD 6장 S00~S13).
 * - 경로 → 화면 키(ScreenKey) 매핑을 여기 한 곳에 둡니다. `screen_view`는 이 키로 기록합니다
 *   (라우트 경로를 그대로 넘기면 store가 기록을 버립니다 — T1.6 R2).
 * - 화면 컴포넌트(lazy import)는 `screens.ts`에 있습니다.
 */
import { matchPath } from 'react-router-dom';
import type { ScreenKey } from '../domain/events';

/** 경로 상수. 화면 이동은 문자열 대신 이 값(또는 placePath)을 쓰세요. */
export const PATHS = {
  lang: '/lang',
  home: '/',
  course: '/course',
  place: '/place/:id',
  order: '/order',
  practice: '/practice',
  result: '/result',
  staff: '/staff',
  reply: '/reply',
  phrases: '/phrases',
  saved: '/saved',
  settings: '/settings',
  report: '/report',
} as const satisfies Record<ScreenKey, string>;

/** `/place/:id` 경로 만들기 */
export function placePath(id: string): string {
  return `/place/${encodeURIComponent(id)}`;
}

export type RouteInfo = {
  path: string;
  screen: ScreenKey;
  /** 하단 탭바 표시 */
  tabBar: boolean;
  /** 데스크톱에서 폰 폭(430px) 제한 없이 넓게 (S13만) */
  wide: boolean;
};

const TAB_SCREENS: readonly ScreenKey[] = ['home', 'course', 'phrases', 'saved', 'settings'];

/** 13개 라우트 (task.md T2.0 라우트 표 순서) */
export const ROUTES: readonly RouteInfo[] = (Object.keys(PATHS) as ScreenKey[]).map((screen) => ({
  path: PATHS[screen],
  screen,
  tabBar: TAB_SCREENS.includes(screen),
  wide: screen === 'report',
}));

/** 현재 경로의 라우트 정보 (없으면 null) */
export function routeForPath(pathname: string): RouteInfo | null {
  return ROUTES.find((r) => matchPath({ path: r.path, end: true }, pathname)) ?? null;
}

/** 경로 → 화면 키 (`/place/ssd` → 'place'). 라우트 표에 없으면 null */
export function screenKeyForPath(pathname: string): ScreenKey | null {
  return routeForPath(pathname)?.screen ?? null;
}
