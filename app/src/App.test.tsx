import { render, screen } from '@testing-library/react';
import App from './App';
import { useAppStore } from './store/useAppStore';
import { getTts } from './speech/tts';
import { toNative, toSino } from './domain/numerals';

// 실제 화면 내용과 분리 (R1 M02): 화면 task가 화면을 채워도 이 테스트는 영향 없음
vi.mock('./router/screens', async () => {
  const { SCREEN_KEYS } = await import('./domain/events');
  return {
    SCREENS: Object.fromEntries(
      SCREEN_KEYS.map((k) => [k, () => <section data-testid={`screen-${k}`} />]),
    ),
  };
});

afterEach(() => {
  useAppStore.setState({ lang: null, events: [] });
  localStorage.clear();
  window.location.hash = '';
});

describe('앱 골격 스모크', () => {
  it('첫 실행(언어 미선택)이면 언어 선택 화면이 열린다', async () => {
    render(<App />);
    expect(await screen.findByTestId('screen-lang')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/lang');
  });

  it('HashRouter: #/course로 열면 코스 화면', async () => {
    useAppStore.setState({ lang: 'en' });
    window.location.hash = '#/course';
    render(<App />);
    expect(await screen.findByTestId('screen-course')).toBeInTheDocument();
  });

  it('TTS 계약 ④: bindAutoCancel을 앱 루트에서 1회 등록·해제', async () => {
    const unbind = vi.fn();
    const spy = vi.spyOn(getTts(), 'bindAutoCancel').mockReturnValue(unbind);
    const { unmount } = render(<App />);
    await screen.findByTestId('screen-lang');
    expect(spy).toHaveBeenCalledTimes(1);
    unmount();
    expect(unbind).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('lang 슬라이스: 초기 null, setLang으로 변경', () => {
    expect(useAppStore.getState().lang).toBeNull();
    useAppStore.getState().setLang('ja');
    expect(useAppStore.getState().lang).toBe('ja');
  });

  it('numerals 시그니처가 존재한다 (구현은 T1.3)', () => {
    // 반환값 검증은 T1.3 소유 numerals.test.ts 에서만 합니다.
    expect(typeof toNative).toBe('function');
    expect(typeof toSino).toBe('function');
  });
});
