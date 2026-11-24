import { act, render, screen } from '@testing-library/react';
import { getBundle } from '../../data';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { SEASON_TICK_MS, SeasonCard } from './SeasonCard';

const ev = getBundle('jungang-market')!.course.events![0];
const kst = (iso: string) => new Date(`${iso}+09:00`);

afterEach(() => useAppStore.setState({ lang: null }));

describe('야시장 시즌 카드 (T5.1)', () => {
  it('EN: 이름·설명·일정(요일·시간·기간)·장소·다음 개장일·방문 전 확인 안내', () => {
    useAppStore.setState({ lang: 'en' });
    render(<SeasonCard event={ev} now={kst('2026-11-24T10:00:00')} />);
    const card = screen.getByTestId('season-totojeul-2026');
    expect(card).toHaveAttribute('data-status', 'next');
    expect(card).toHaveTextContent('Totojeul Food Festa (night market)');
    expect(card).toHaveTextContent('Every Fri, Sat, 18:00–22:00 · Aug 14 – Nov 28');
    expect(card).toHaveTextContent('Hwawol-tong area, Jungang Market');
    expect(screen.getByRole('status')).toHaveTextContent('Next: Fri, Nov 27 · 18:00–22:00');
    expect(card).toHaveTextContent(t('en', 'season.note'));
  });

  it('운영 중이면 "Open now" 표시, 기간 뒤면 시즌 종료 안내', () => {
    useAppStore.setState({ lang: 'en' });
    const { unmount } = render(<SeasonCard event={ev} now={kst('2026-11-27T19:00:00')} />);
    expect(screen.getByTestId('season-totojeul-2026')).toHaveAttribute('data-status', 'open');
    expect(screen.getByRole('status')).toHaveTextContent('Open now · until 22:00');
    unmount();
    render(<SeasonCard event={ev} now={kst('2026-12-01T12:00:00')} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'This season ended on Nov 28. Next season dates are not announced yet.',
    );
  });

  it('JA·ZH: 사용자 언어로 표시', () => {
    useAppStore.setState({ lang: 'ja' });
    const { unmount } = render(<SeasonCard event={ev} now={kst('2026-11-24T10:00:00')} />);
    expect(screen.getByTestId('season-totojeul-2026')).toHaveTextContent('トトジュル');
    expect(screen.getByRole('status')).toHaveTextContent('次回');
    unmount();
    useAppStore.setState({ lang: 'zh' });
    render(<SeasonCard event={ev} now={kst('2026-11-24T10:00:00')} />);
    expect(screen.getByRole('status')).toHaveTextContent('下次');
  });
});

describe('열어 둔 카드의 시간 경과 갱신 (R1 M-2)', () => {
  afterEach(() => vi.useRealTimers());

  it('개장 전 → 18:00 지나면 운영 중 → 마지막 날 22:00 지나면 시즌 종료', () => {
    useAppStore.setState({ lang: 'en' });
    vi.useFakeTimers();
    vi.setSystemTime(kst('2026-11-28T17:59:30'));
    render(<SeasonCard event={ev} />);
    const card = () => screen.getByTestId('season-totojeul-2026');
    expect(card()).toHaveAttribute('data-status', 'today');
    act(() => vi.advanceTimersByTime(SEASON_TICK_MS));
    expect(card()).toHaveAttribute('data-status', 'open');
    act(() => vi.advanceTimersByTime(4 * 60 * SEASON_TICK_MS));
    expect(card()).toHaveAttribute('data-status', 'ended');
  });

  it('화면으로 돌아오면 바로 다시 계산', () => {
    useAppStore.setState({ lang: 'en' });
    vi.useFakeTimers();
    vi.setSystemTime(kst('2026-11-27T17:00:00'));
    render(<SeasonCard event={ev} />);
    expect(screen.getByTestId('season-totojeul-2026')).toHaveAttribute('data-status', 'today');
    vi.setSystemTime(kst('2026-11-27T19:00:00')); // 타이머 없이 시간만 흐름 (백그라운드)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('season-totojeul-2026')).toHaveAttribute('data-status', 'open');
  });
});
