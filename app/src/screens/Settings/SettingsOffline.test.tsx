import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../router/AppRoutes';
import { useAppStore } from '../../store/useAppStore';
import { resetPwaForTest, usePwaStore } from '../../sw/pwa';
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
});
