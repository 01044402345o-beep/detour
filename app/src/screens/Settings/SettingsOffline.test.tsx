import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../router/AppRoutes';
import { useAppStore } from '../../store/useAppStore';
import type { PrecacheStatus } from '../../sw/messages';
import { resetPwaForTest, startPwa, usePwaStore } from '../../sw/pwa';
import type { Lang } from '../../types';

vi.mock('../../router/screens', async () => {
  const { SCREEN_KEYS } = await import('../../domain/events');
  const Settings = (await import('./index')).default;
  return {
    SCREENS: Object.fromEntries(
      SCREEN_KEYS.map((k) => [
        k,
        k === 'settings' ? Settings : () => <section data-testid={`screen-${k}`} />,
      ]),
    ),
  };
});

function renderSettings(lang: Lang) {
  useAppStore.setState({ lang, events: [] });
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

afterEach(() => {
  resetPwaForTest();
  useAppStore.setState({ lang: null, events: [] });
  localStorage.clear();
});

describe('S12 설정 — 오프라인 준비 완료 표시 (T3.1)', () => {
  it('프리캐시가 다 차기 전에는 표시하지 않고, 다 차면 표시', async () => {
    renderSettings('en');
    await screen.findByTestId('screen-settings');
    expect(screen.queryByTestId('offline-ready')).not.toBeInTheDocument();

    act(() => usePwaStore.setState({ offlineReady: true }));
    expect(screen.getByTestId('offline-ready')).toHaveTextContent('Ready to use offline');
  });

  it('현재 언어로 표시 (zh)', async () => {
    usePwaStore.setState({ offlineReady: true });
    renderSettings('zh');
    expect(await screen.findByTestId('offline-ready')).toHaveTextContent('已可离线使用');
  });

  it('설정 화면에 들어오면 준비 판정을 즉시 다시 함 (앞선 판정 시점을 모두 놓친 경우, T3.1 R2)', async () => {
    let controlled = false;
    const readStatus = vi.fn(async (): Promise<PrecacheStatus | null> =>
      controlled ? { total: 52, cached: 52 } : null,
    );
    startPwa({
      enabled: () => true,
      register: async () => async () => {},
      readStatus,
      onControllerChange: () => {},
    });
    await act(async () => {});
    expect(usePwaStore.getState().offlineReady).toBe(false);
    const before = readStatus.mock.calls.length;
    controlled = true; // 이제 준비됐지만 알려 주는 이벤트는 없음 (간격 재확인 1초보다 먼저 확인)
    renderSettings('en');
    expect(
      await screen.findByTestId('offline-ready', undefined, { timeout: 500 }),
    ).toHaveTextContent('Ready to use offline');
    expect(readStatus.mock.calls.length).toBeGreaterThan(before);
  });
});
