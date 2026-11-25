/**
 * 경로가 바뀌면 일반 토스트만 닫힘 (DESIGN.md 6장, T6.0). SW 업데이트 안내는 남음.
 * 화면은 테스트용(토스트 버튼)으로 바꿉니다 — AppRoutes.test.tsx와 같은 방식.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { resetPwaForTest, usePwaStore } from '../sw/pwa';
import { TOAST_MS, TOAST_ROUTE_GRACE_MS } from '../ui/Toast';
import { AppRoutes } from './AppRoutes';

vi.mock('./screens', async () => {
  const { SCREEN_KEYS } = await import('../domain/events');
  const { useToast: useT } = await import('../ui/toastContext');
  const { useNavigate: useNav } = await import('react-router-dom');
  function Screen({ k }: { k: string }) {
    const toast = useT();
    const navigate = useNav();
    return (
      <section data-testid={`screen-${k}`}>
        <button type="button" onClick={() => toast(`toast-${k}`)}>
          show
        </button>
        <button
          type="button"
          onClick={() => {
            toast(`moved-${k}`);
            navigate('/saved');
          }}
        >
          show-and-go
        </button>
      </section>
    );
  }
  return {
    SCREENS: Object.fromEntries(SCREEN_KEYS.map((k) => [k, () => <Screen k={k} />])),
  };
});

function renderAt(path: string) {
  useAppStore.setState({ lang: 'en', events: [] });
  const ref: { nav: NavigateFunction | null } = { nav: null };
  function Grab() {
    ref.nav = useNavigate();
    return null;
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <Grab />
      <AppRoutes />
    </MemoryRouter>,
  );
  return { go: (to: string) => act(() => void ref.nav!(to)) };
}

const region = () => screen.getByTestId('toast-region');

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  vi.useRealTimers();
  resetPwaForTest();
  useAppStore.setState({ lang: null, events: [] });
  localStorage.clear();
});

describe('경로 변경 시 토스트 정리', () => {
  it('지난 화면의 일반 토스트는 다른 화면으로 가면 닫힘', async () => {
    const { go } = renderAt('/phrases');
    await act(async () => {});
    fireEvent.click(screen.getByText('show'));
    expect(region()).toHaveTextContent('toast-phrases');
    act(() => vi.advanceTimersByTime(TOAST_ROUTE_GRACE_MS));
    go('/saved');
    await act(async () => {});
    expect(screen.getByTestId('screen-saved')).toBeInTheDocument();
    expect(region()).not.toHaveTextContent('toast-phrases');
  });

  it('토스트를 띄운 동작이 곧바로 화면을 옮기면 그 토스트는 다음 화면에 남음', async () => {
    renderAt('/settings');
    await act(async () => {});
    fireEvent.click(screen.getByText('show-and-go'));
    await act(async () => {});
    expect(screen.getByTestId('screen-saved')).toBeInTheDocument();
    expect(region()).toHaveTextContent('moved-settings');
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(region()).not.toHaveTextContent('moved-settings');
  });

  it('SW 업데이트 안내는 화면을 옮겨도 남음', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { go } = renderAt('/phrases');
    await act(async () => {});
    act(() => usePwaStore.setState({ needRefresh: true }));
    fireEvent.click(screen.getByText('show'));
    act(() => vi.advanceTimersByTime(TOAST_ROUTE_GRACE_MS));
    go('/saved');
    await act(async () => {});
    expect(screen.getByTestId('update-toast')).toBeInTheDocument();
    expect(region()).not.toHaveTextContent('toast-phrases');
  });
});
