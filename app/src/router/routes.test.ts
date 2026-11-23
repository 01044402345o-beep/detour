import { SCREEN_KEYS, isScreenKey } from '../domain/events';
import { PATHS, ROUTES, placePath, routeForPath, screenKeyForPath } from './routes';

describe('라우트 표 (T2.0)', () => {
  it('task.md 라우트 13개가 SCREEN_KEYS와 1:1', () => {
    expect(ROUTES.map((r) => r.path)).toEqual([
      '/lang',
      '/',
      '/course',
      '/place/:id',
      '/order',
      '/practice',
      '/result',
      '/staff',
      '/reply',
      '/phrases',
      '/saved',
      '/settings',
      '/report',
    ]);
    expect(ROUTES.map((r) => r.screen)).toEqual([...SCREEN_KEYS]);
  });

  it('경로 → 화면 키 (기록이 버려지지 않는 키)', () => {
    expect(screenKeyForPath('/')).toBe('home');
    expect(screenKeyForPath('/lang')).toBe('lang');
    expect(screenKeyForPath('/place/ssd')).toBe('place');
    expect(screenKeyForPath(placePath('gwc'))).toBe('place');
    expect(screenKeyForPath('/report')).toBe('report');
    for (const r of ROUTES) {
      const sample = r.path.replace(':id', 'x');
      expect(isScreenKey(screenKeyForPath(sample))).toBe(true);
    }
  });

  it('라우트 표에 없는 경로는 null', () => {
    expect(screenKeyForPath('/nope')).toBeNull();
    expect(screenKeyForPath('/place')).toBeNull();
    expect(screenKeyForPath('/place/a/b')).toBeNull();
  });

  it('넓은 화면은 /report만, 탭바는 탭 5개 화면만', () => {
    expect(ROUTES.filter((r) => r.wide).map((r) => r.path)).toEqual([PATHS.report]);
    expect(ROUTES.filter((r) => r.tabBar).map((r) => r.screen)).toEqual([
      'home',
      'course',
      'phrases',
      'saved',
      'settings',
    ]);
    expect(routeForPath('/practice')?.tabBar).toBe(false);
  });

  it('placePath는 ID를 인코딩', () => {
    expect(placePath('a b')).toBe('/place/a%20b');
  });
});
