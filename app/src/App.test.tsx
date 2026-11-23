import { render, screen } from '@testing-library/react';
import App from './App';
import { useAppStore } from './store/useAppStore';
import { toNative, toSino } from './domain/numerals';

describe('앱 골격 스모크', () => {
  it('빈 App이 렌더링된다', () => {
    render(<App />);
    expect(screen.getByTestId('app-root')).toBeInTheDocument();
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
