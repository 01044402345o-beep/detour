import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { course } from '../../data';
import { AppRoutes } from '../../router/AppRoutes';
import type { SpeakResult, Tts } from '../../speech/tts';
import { useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import { TOAST_MS } from '../../ui';

const fake = vi.hoisted(() => ({ result: 'started' as SpeakResult }));

const tts = {
  init: vi.fn(async () => 'ready' as const),
  getState: vi.fn(() => 'ready' as const),
  speak: vi.fn((): SpeakResult => fake.result),
  cancel: vi.fn(),
  bindAutoCancel: vi.fn(() => () => {}),
} satisfies Tts;

vi.mock('../../speech/tts', async (orig) => ({
  ...(await orig<typeof import('../../speech/tts')>()),
  getTts: () => tts,
}));

vi.mock('../../router/screens', async () => {
  const { SCREEN_KEYS } = await import('../../domain/events');
  const Home = (await import('./index')).default;
  return {
    SCREENS: Object.fromEntries(
      SCREEN_KEYS.map((k) => [
        k,
        k === 'home' ? Home : () => <section data-testid={`screen-${k}`} />,
      ]),
    ),
  };
});

async function renderHome(lang: Lang = 'en') {
  useAppStore.setState({ lang, events: [] });
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return screen.findByTestId('screen-home');
}

beforeEach(() => {
  fake.result = 'started';
  tts.speak.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  useAppStore.setState({ lang: null, events: [] });
  localStorage.clear();
});

const toastText = () => screen.getByTestId('toast-region').textContent;

describe('S01 홈 — 거점·배너', () => {
  it('원도심 카드 → 코스 지도', async () => {
    await renderHome();
    fireEvent.click(screen.getByTestId('hub-downtown'));
    expect(await screen.findByTestId('screen-course')).toBeInTheDocument();
  });

  it('"See map" → 코스 지도', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'See map' }));
    expect(await screen.findByTestId('screen-course')).toBeInTheDocument();
  });

  it('원도심 카드에 정류장 수·도보 합계(35분, 대전역 출발)·DEMO 표시', async () => {
    await renderHome();
    const hub = screen.getByTestId('hub-downtown');
    expect(hub).toHaveTextContent(`${course.stops.length} spots`);
    expect(hub).toHaveTextContent('35 min');
    expect(hub).toHaveTextContent('DEMO');
  });

  it.each(['hub-station', 'hub-yuseong', 'overnight-banner'])(
    '잠긴 거점·1박 배너(%s) → "Coming soon" 토스트, 이동 없음',
    async (id) => {
      await renderHome();
      vi.useFakeTimers();
      fireEvent.click(screen.getByTestId(id));
      expect(toastText()).toBe('Coming soon — Old Downtown is open in this demo.');
      expect(screen.getByTestId('screen-home')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(TOAST_MS));
      expect(toastText()).toBe('');
    },
  );

  it('잠긴 카드의 이름에 Coming soon이 포함 (화면 낭독기)', async () => {
    await renderHome();
    expect(screen.getByRole('button', { name: /Station & Sojedong/ })).toHaveAccessibleName(
      /Coming soon/,
    );
  });
});

describe('S01 홈 — 오늘의 코스 (F-02)', () => {
  it('코스 이름·요약·정류장 4곳 순서대로, 누르면 코스 지도', async () => {
    await renderHome();
    const card = screen.getByTestId('today-course');
    expect(card).toHaveTextContent('Old Downtown Half-day');
    expect(card).toHaveTextContent('4 stops · 2.2 km · about 3 hrs');
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('1');
    fireEvent.click(card);
    expect(await screen.findByTestId('screen-course')).toBeInTheDocument();
  });
});

describe('S01 홈 — 오늘의 문장 듣기', () => {
  it('한국어 문장·발음(EN 로마자)·뜻 표시', async () => {
    await renderHome();
    const card = screen.getByTestId('today-phrase');
    expect(card).toHaveTextContent('포장해 주세요');
    expect(card.querySelector('[data-pron="roman"]')).not.toBeNull();
  });

  it('JA는 가타카나 발음·일본어 뜻', async () => {
    await renderHome('ja');
    const card = screen.getByTestId('today-phrase');
    expect(card.querySelector('[data-pron="kana"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: '今日のフレーズ' })).toBeInTheDocument();
  });

  it('듣기 → speak(한국어, 1) + phrase_play(실제 ID ssd/ssd-2) 1건', async () => {
    await renderHome();
    fireEvent.click(within(screen.getByTestId('today-phrase')).getByRole('button'));
    expect(tts.speak).toHaveBeenCalledWith('포장해 주세요', 1, expect.any(Function));
    const plays = useAppStore.getState().events.filter((e) => e.type === 'phrase_play');
    expect(plays).toEqual([
      expect.objectContaining({ src: 'phrase', placeId: 'ssd', phraseId: 'ssd-2' }),
    ]);
  });

  it('재생이 시작되지 않으면 phrase_play를 기록하지 않음', async () => {
    fake.result = 'unsupported';
    await renderHome();
    fireEvent.click(within(screen.getByTestId('today-phrase')).getByRole('button'));
    expect(useAppStore.getState().events.some((e) => e.type === 'phrase_play')).toBe(false);
  });
});

describe('S01 홈 — 탭바·기록', () => {
  it('하단 탭바 표시, 홈 탭이 현재 화면', async () => {
    await renderHome();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /Explore/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('screen_view는 라우터 1건뿐 (화면이 중복 기록하지 않음)', async () => {
    await renderHome();
    const views = useAppStore.getState().events.filter((e) => e.type === 'screen_view');
    expect(views).toEqual([expect.objectContaining({ screen: 'home' })]);
  });
});
