import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import type { AppEvent } from '../domain/events';
import { useAppStore } from '../store/useAppStore';
import type { Lang } from '../types';
import { AppRoutes } from './AppRoutes';
import { setLaunchIntroPending } from './launchIntro';
import { ROUTES } from './routes';

/**
 * 라우터 계약 테스트는 실제 화면과 분리합니다 (R1 M02): 화면 task가 화면을 채워도 깨지지 않게
 * 13개 화면을 모두 테스트용 빈 section으로 바꿉니다. 실제 화면 연결은 screens.test.ts가 존재만 확인.
 */
vi.mock('./screens', async () => {
  const { SCREEN_KEYS } = await import('../domain/events');
  return {
    SCREENS: Object.fromEntries(
      SCREEN_KEYS.map((k) => [k, () => <section data-testid={`screen-${k}`} />]),
    ),
  };
});

function renderAt(path: string, lang: Lang | null = 'en') {
  useAppStore.setState({ lang, events: [] });
  const ref: { nav: NavigateFunction | null } = { nav: null };
  function Grab() {
    ref.nav = useNavigate();
    return null;
  }
  const r = render(
    <MemoryRouter initialEntries={[path]}>
      <Grab />
      <AppRoutes />
    </MemoryRouter>,
  );
  const go = (to: string) => act(() => void ref.nav!(to));
  return { ...r, go };
}

const screenViews = () =>
  useAppStore
    .getState()
    .events.filter((e): e is Extract<AppEvent, { type: 'screen_view' }> => e.type === 'screen_view')
    .map((e) => e.screen);

afterEach(() => {
  useAppStore.setState({ lang: null, events: [] });
  localStorage.clear();
});

describe('모든 라우트가 열림 (테스트용 화면)', () => {
  for (const r of ROUTES) {
    const path = r.path.replace(':id', 'ssd');
    it(`${path} → screen-${r.screen}`, async () => {
      renderAt(path);
      expect(await screen.findByTestId(`screen-${r.screen}`)).toBeInTheDocument();
      expect(screenViews()).toEqual([r.screen]);
    });
  }
});

describe('첫 실행 리다이렉트', () => {
  it('언어 미선택이면 어느 경로든 /lang', async () => {
    renderAt('/place/ssd', null);
    expect(await screen.findByTestId('screen-lang')).toBeInTheDocument();
    // 리다이렉트 전 경로는 기록하지 않음
    expect(screenViews()).toEqual(['lang']);
  });

  it('언어를 고르면 다른 화면으로 갈 수 있음', async () => {
    const { go } = renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    act(() => useAppStore.getState().setLang('ja'));
    go('/');
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
    expect(screenViews()).toEqual(['lang', 'home']);
  });

  it('라우트 표에 없는 경로는 홈으로', async () => {
    renderAt('/unknown/path');
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
    expect(screenViews()).toEqual(['home']);
  });
});

describe('앱을 열 때마다 인트로 (T6.8)', () => {
  it('언어를 골랐어도 앱을 열어 첫 화면이 홈이면 인트로가 먼저', async () => {
    setLaunchIntroPending(true);
    renderAt('/', 'en');
    expect(await screen.findByTestId('screen-lang')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-home')).toBeNull();
  });

  it('인트로를 지난 뒤 같은 페이지 안에서 홈으로 가면 인트로가 다시 끼어들지 않음', async () => {
    setLaunchIntroPending(true);
    const { go } = renderAt('/', 'en');
    await screen.findByTestId('screen-lang');
    go('/');
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
    go('/course');
    go('/');
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
  });

  it('StrictMode에서도 인트로 → 홈 이동의 screen_view가 정확히 lang, home 한 번씩', async () => {
    setLaunchIntroPending(true);
    useAppStore.setState({ lang: 'en', events: [] });
    const ref: { nav: NavigateFunction | null } = { nav: null };
    function Grab() {
      ref.nav = useNavigate();
      return null;
    }
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/']}>
          <Grab />
          <AppRoutes />
        </MemoryRouter>
      </StrictMode>,
    );
    expect(await screen.findByTestId('screen-lang')).toBeInTheDocument();
    act(() => void ref.nav!('/', { replace: true })); // 인트로의 시작 버튼과 같은 이동
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
    expect(screenViews()).toEqual(['lang', 'home']);
  });

  it('특정 화면 주소로 바로 열면(새로고침·링크) 그 화면 그대로, 이후 홈도 그대로', async () => {
    setLaunchIntroPending(true);
    const { go } = renderAt('/place/ssd', 'en');
    expect(await screen.findByTestId('screen-place')).toBeInTheDocument();
    go('/');
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
  });
});

describe('screen_view 기록', () => {
  it('이동할 때마다 화면 키로 1회씩 (경로 문자열이 아님)', async () => {
    const { go } = renderAt('/');
    await screen.findByTestId('screen-home');
    go('/place/ssd');
    await screen.findByTestId('screen-place');
    go('/place/gwc');
    go('/order');
    await screen.findByTestId('screen-order');
    expect(screenViews()).toEqual(['home', 'place', 'place', 'order']);
  });
});

describe('앱 틀', () => {
  it('/report만 넓은 틀, 나머지는 폰 폭', async () => {
    const { go } = renderAt('/settings');
    await screen.findByTestId('screen-settings');
    expect(screen.getByTestId('app-frame')).toHaveAttribute('data-wide', 'false');
    expect(screen.getByTestId('app-frame')).not.toHaveClass('app-frame--wide');
    go('/report');
    await screen.findByTestId('screen-report');
    expect(screen.getByTestId('app-frame')).toHaveClass('app-frame--wide');
  });

  it('탭바는 탭 화면에만', async () => {
    const { go } = renderAt('/');
    await screen.findByTestId('screen-home');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    go('/practice');
    await screen.findByTestId('screen-practice');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('시트·토스트 자리(#app-overlay)가 틀 안에 있음', async () => {
    renderAt('/');
    await screen.findByTestId('screen-home');
    const overlay = document.getElementById('app-overlay');
    expect(overlay).not.toBeNull();
    expect(screen.getByTestId('app-frame')).toContainElement(overlay);
  });
});
