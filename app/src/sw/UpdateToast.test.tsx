import { act, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../store/useAppStore';
import { ToastProvider } from '../ui/Toast';
import { resetPwaForTest, usePwaStore } from './pwa';

afterEach(() => {
  resetPwaForTest();
  useAppStore.setState({ lang: null });
});

function renderProvider() {
  return render(
    <ToastProvider>
      <p>app</p>
    </ToastProvider>,
  );
}

describe('업데이트 토스트 (ToastProvider 연결)', () => {
  it('새 버전이 없으면 보이지 않음, 알림 영역은 항상 있음', () => {
    renderProvider();
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('새 버전 대기 시 현재 언어로 표시, 버튼 2개', () => {
    useAppStore.setState({ lang: 'ja' });
    renderProvider();
    act(() => usePwaStore.setState({ needRefresh: true }));
    expect(screen.getByTestId('update-toast')).toHaveTextContent('新しいバージョンがあります。');
    expect(screen.getByRole('status')).toContainElement(screen.getByTestId('update-toast'));
    expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'あとで' })).toBeInTheDocument();
  });

  it('업데이트·나중에 → 토스트 닫힘', () => {
    useAppStore.setState({ lang: 'en' });
    renderProvider();
    act(() => usePwaStore.setState({ needRefresh: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();

    act(() => usePwaStore.setState({ needRefresh: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
  });
});
