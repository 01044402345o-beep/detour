/** 화면 컴포넌트 lazy import (라우트당 1개 청크). 키는 routes.ts의 ScreenKey와 같습니다. */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ScreenKey } from '../domain/events';

export const SCREENS: Readonly<Record<ScreenKey, LazyExoticComponent<ComponentType>>> = {
  lang: lazy(() => import('../screens/Lang')),
  home: lazy(() => import('../screens/Home')),
  course: lazy(() => import('../screens/Course')),
  place: lazy(() => import('../screens/Place')),
  order: lazy(() => import('../screens/Order')),
  practice: lazy(() => import('../screens/Practice')),
  result: lazy(() => import('../screens/Result')),
  staff: lazy(() => import('../screens/Staff')),
  reply: lazy(() => import('../screens/Reply')),
  phrases: lazy(() => import('../screens/Phrases')),
  saved: lazy(() => import('../screens/Saved')),
  settings: lazy(() => import('../screens/Settings')),
  report: lazy(() => import('../screens/Report')),
};
