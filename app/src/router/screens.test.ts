/**
 * 실제 화면 연결 존재 검사 (R1 M02). 렌더링·내용은 검사하지 않습니다 — 화면 내용은 각 화면 task 소유.
 */
import { SCREEN_KEYS, type ScreenKey } from '../domain/events';
import { SCREENS } from './screens';

const MODULES: Record<ScreenKey, () => Promise<{ default: unknown }>> = {
  lang: () => import('../screens/Lang'),
  home: () => import('../screens/Home'),
  course: () => import('../screens/Course'),
  place: () => import('../screens/Place'),
  order: () => import('../screens/Order'),
  practice: () => import('../screens/Practice'),
  result: () => import('../screens/Result'),
  staff: () => import('../screens/Staff'),
  reply: () => import('../screens/Reply'),
  phrases: () => import('../screens/Phrases'),
  saved: () => import('../screens/Saved'),
  settings: () => import('../screens/Settings'),
  report: () => import('../screens/Report'),
};

describe('SCREENS: 13개 화면 lazy 연결', () => {
  it('키가 SCREEN_KEYS와 같음', () => {
    expect(Object.keys(SCREENS).sort()).toEqual([...SCREEN_KEYS].sort());
  });

  for (const key of SCREEN_KEYS) {
    it(`screens/${key}: default export가 컴포넌트 함수`, async () => {
      const mod = await MODULES[key]();
      expect(typeof mod.default).toBe('function');
    });
  }
});
