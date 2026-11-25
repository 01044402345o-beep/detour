import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { course } from '../../data';
import { photoForArea, photoUrl } from '../../data/photos';
import { AppRoutes } from '../../router/AppRoutes';
import type { SpeakResult, Tts } from '../../speech/tts';
import { useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import { TOAST_MS } from '../../ui';
import { HOME_TICK_MS } from './index';

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

/** 현재 경로 (다른 화면이 가짜라 이동 확인용) */
function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

async function renderHome(lang: Lang = 'en') {
  useAppStore.setState({ lang, events: [] });
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
      <Loc />
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

describe('S01 홈 — 1호선 3권역 (T6.2)', () => {
  it('노선 제목과 3권역이 실제 노선 순서(대전역 → 원도심 → 유성)로 표시', async () => {
    await renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Three areas on Metro Line 1',
    );
    const line = screen.getByRole('list', { name: 'Areas by Metro Line 1 station' });
    const items = within(line).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByTestId('hub-station')).toBeInTheDocument();
    expect(within(items[1]).getByTestId('hub-downtown')).toBeInTheDocument();
    expect(within(items[2]).getByTestId('hub-yuseong')).toBeInTheDocument();
  });

  it('원도심 카드 아무 곳 → 원도심 코스 지도', async () => {
    await renderHome();
    fireEvent.click(screen.getByTestId('hub-downtown'));
    expect(await screen.findByTestId('screen-course')).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/course$/);
  });

  it('"Start the course" → 원도심 코스 지도 (한 번만 이동)', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Start the course' }));
    expect(await screen.findByTestId('screen-course')).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/course$/);
    const views = useAppStore.getState().events.filter((e) => e.type === 'screen_view');
    expect(views.map((e) => e.screen)).toEqual(['home', 'course']);
  });

  it('원도심 카드에 이름(h2)·코스 요약(4곳·2.2km·약 3시간)·출발 안내', async () => {
    await renderHome();
    const hub = screen.getByTestId('hub-downtown');
    expect(within(hub).getByRole('heading', { level: 2 })).toHaveTextContent('Old Downtown');
    expect(hub).toHaveTextContent('Old Downtown Half-day');
    expect(hub).toHaveTextContent(
      `${course.stops.length} stops · ${course.distanceKm} km · about 3 hrs`,
    );
    expect(hub).toHaveTextContent(`Starts at ${course.start.name.en}`);
    expect(hub).toHaveTextContent('Open');
  });

  it('대전역·소제동 카드 = 전통시장 코스 (4곳·0.7km) → 시장 코스 지도 (T5.1)', async () => {
    await renderHome();
    const hub = screen.getByTestId('hub-station');
    expect(hub).toHaveTextContent('Traditional Market');
    expect(hub).toHaveTextContent('Jungang Market Food Walk');
    expect(hub).toHaveTextContent('4 stops · 0.7 km · about 2 hrs');
    expect(hub).not.toHaveTextContent('Coming');
    fireEvent.click(hub);
    expect(await screen.findByTestId('screen-course')).toBeInTheDocument();
    // 다른 화면은 이 파일에서 가짜이므로 이동 경로(?c=)로 확인 (실제 코스 화면은 Course.test)
    expect(screen.getByTestId('loc')).toHaveTextContent('/course?c=jungang-market');
  });

  it('유성 → "Coming soon" 토스트, 이동 없음', async () => {
    await renderHome();
    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId('hub-yuseong'));
    expect(toastText()).toBe(
      'Coming soon — Old Downtown and Jungang Market are open in this demo.',
    );
    expect(screen.getByTestId('screen-home')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(toastText()).toBe('');
  });

  it('잠긴 카드의 이름에 Coming later가 포함 (화면 낭독기)', async () => {
    await renderHome();
    expect(screen.getByTestId('hub-yuseong')).toHaveAccessibleName(/Coming later/);
  });

  it('언어 버튼: 현재 언어 표시, 누르면 설정', async () => {
    await renderHome('ja');
    const btn = screen.getByTestId('home-lang');
    expect(btn).toHaveTextContent('JA');
    expect(btn).toHaveAccessibleName(/日本語/);
    fireEvent.click(btn);
    expect(await screen.findByTestId('screen-settings')).toBeInTheDocument();
  });

  it('JA: 노선 제목·권역 이름이 일본어', async () => {
    await renderHome('ja');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '地下鉄1号線の3つのエリア',
    );
    expect(screen.getByTestId('hub-downtown')).toHaveTextContent('旧都心');
    expect(screen.getByTestId('hub-yuseong')).toHaveTextContent('儒城温泉');
  });

  it('역 이름은 한글 + 현지어 병기 (R1 L-1)', async () => {
    await renderHome('ja');
    expect(screen.getByTestId('hub-station')).toHaveTextContent('대전역 · 大田駅');
    expect(screen.getByTestId('hub-downtown')).toHaveTextContent('중앙로 · 中央路駅');
    expect(screen.getByTestId('hub-yuseong')).toHaveTextContent('유성온천 · 儒城温泉駅');
    expect(screen.getByTestId('screen-home')).toHaveAttribute('lang', 'ja');
  });

  it('ZH 역 이름 병기, 화면 언어 zh-Hans', async () => {
    await renderHome('zh');
    expect(screen.getByTestId('hub-station')).toHaveTextContent('대전역 · 大田站');
    expect(screen.getByTestId('screen-home')).toHaveAttribute('lang', 'zh-Hans');
  });
});

describe('S01 홈 — 야시장 한 줄 (season.ts 판단)', () => {
  /** 서울 시각으로 시계 고정 */
  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${iso}+09:00`));
  };

  it('기간 안(다음 개장일 대기)이면 대전역 카드 아래에 요일·시간·종료일 한 줄', async () => {
    at('2026-11-24T10:00:00');
    await renderHome();
    const line = screen.getByTestId('home-night-market');
    expect(line).toHaveTextContent('Night market Fri, Sat 18:00–22:00, until Nov 28');
    const stationItem = screen.getByTestId('hub-station').closest('li')!;
    expect(stationItem).toContainElement(line);
  });

  it('기간 안(지금 열림)이어도 표시', async () => {
    at('2026-11-27T19:00:00');
    await renderHome();
    expect(screen.getByTestId('home-night-market')).toBeInTheDocument();
  });

  it('시즌이 끝나면 숨김', async () => {
    at('2026-12-01T12:00:00');
    await renderHome();
    expect(screen.queryByTestId('home-night-market')).toBeNull();
  });

  /** 같은 마운트에서 시간이 흐름: Date·setInterval만 가짜 (findBy의 setTimeout은 실제) */
  const clock = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(`${iso}+09:00`));
  };

  it('홈에 머문 채 마지막 날 22:00을 넘기면 1분 갱신으로 숨김 (R1 L-3)', async () => {
    clock('2026-11-28T21:59:30');
    await renderHome();
    expect(screen.getByTestId('home-night-market')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(HOME_TICK_MS));
    expect(screen.queryByTestId('home-night-market')).toBeNull();
  });

  it('홈에 머문 채 시즌 첫날 0시를 넘기면 1분 갱신으로 표시 (R1 L-3)', async () => {
    clock('2026-08-13T23:59:30');
    await renderHome();
    expect(screen.queryByTestId('home-night-market')).toBeNull();
    act(() => vi.advanceTimersByTime(HOME_TICK_MS));
    expect(screen.getByTestId('home-night-market')).toBeInTheDocument();
  });

  it('화면이 다시 보이면(visibilitychange) 바로 다시 판단 (R1 L-3)', async () => {
    clock('2026-11-28T21:00:00');
    await renderHome();
    expect(screen.getByTestId('home-night-market')).toBeInTheDocument();
    vi.setSystemTime(new Date('2026-11-29T10:00:00+09:00')); // 타이머 없이 시간만 흐름 (백그라운드)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.queryByTestId('home-night-market')).toBeNull();
  });

  it('시즌 시작 전이면 숨김', async () => {
    at('2026-08-01T12:00:00');
    await renderHome();
    expect(screen.queryByTestId('home-night-market')).toBeNull();
  });
});

describe('S01 홈 — 사진·출처', () => {
  it('3권역 사진: photos.ts 권역 사진, alt는 장면 설명(현재 언어)', async () => {
    await renderHome();
    for (const [id, area] of [
      ['hub-station', 'station'],
      ['hub-downtown', 'downtown'],
      ['hub-yuseong', 'yuseong'],
    ] as const) {
      const photo = photoForArea(area)!;
      const img = within(screen.getByTestId(id)).getByRole('img', { name: photo.alt.en });
      expect(img.getAttribute('src')).toBe(photoUrl(photo));
      expect(img).toHaveAttribute('decoding', 'async');
    }
    // 첫 화면 위 두 장은 바로, 아래 유성은 늦게 불러옴
    expect(within(screen.getByTestId('hub-yuseong')).getByRole('img')).toHaveAttribute(
      'loading',
      'lazy',
    );
  });

  it('JA alt', async () => {
    await renderHome('ja');
    const photo = photoForArea('downtown')!;
    expect(
      within(screen.getByTestId('hub-downtown')).getByRole('img', { name: photo.alt.ja }),
    ).toBeInTheDocument();
  });

  it('사진 출처 한 줄: 저작자(중복 없이)·라이선스', async () => {
    await renderHome();
    const authors = [
      ...new Set(
        (['station', 'downtown', 'yuseong'] as const).map((a) => photoForArea(a)!.author),
      ),
    ];
    expect(screen.getByTestId('home-photo-credit')).toHaveTextContent(
      `Photo: ${authors.join(', ')} · CC BY-SA 4.0`,
    );
  });
});

describe('S01 홈 — 뺀 블록 (PRD F-02 v0.11)', () => {
  it('인사말·1박 배너·오늘의 코스·오늘의 문장·가로 캐러셀 없음', async () => {
    await renderHome();
    for (const id of ['overnight-banner', 'today-course', 'today-phrase', 'home-hubs']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(screen.queryByText(/Hi there/)).toBeNull();
    expect(screen.queryByText('Phrase of the day')).toBeNull();
    expect(tts.speak).not.toHaveBeenCalled();
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
