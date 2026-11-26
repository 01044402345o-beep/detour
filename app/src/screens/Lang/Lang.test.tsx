import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../router/AppRoutes';
import { STORAGE_KEY, useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRules } from '../../ui/a11y';
import { SCENE_MS } from './index';
import { INTRO_POLL_MS, loadIntroVideo, releaseIntroVideo } from './introMedia';

// 인트로 영상 불러오기: 기본은 실패(null) → 정지 그림 + 4.4초 타이머. 영상 테스트에서만 blob 주소를 돌려줌
vi.mock('./introMedia', async (orig) => ({
  ...(await orig<typeof import('./introMedia')>()),
  loadIntroVideo: vi.fn(async () => null),
  releaseIntroVideo: vi.fn(),
}));

// 다른 화면 task의 화면은 빈 화면으로 바꿔 이 task 화면만 검사합니다.
vi.mock('../../router/screens', async () => {
  const { SCREEN_KEYS } = await import('../../domain/events');
  const Lang = (await import('./index')).default;
  return {
    SCREENS: Object.fromEntries(
      SCREEN_KEYS.map((k) => [
        k,
        k === 'lang' ? Lang : () => <section data-testid={`screen-${k}`} />,
      ]),
    ),
  };
});

function renderAt(path: string, lang: Lang | null) {
  useAppStore.setState({ lang, events: [] });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAppStore.setState({ lang: null, events: [] });
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const radio = (name: string) => screen.getByRole('radio', { name });

describe('S00 언어 선택', () => {
  it('첫 실행(lang null)이면 /lang으로 열리고 EN이 기본 선택, 문구는 영어', async () => {
    renderAt('/', null);
    expect(await screen.findByTestId('screen-lang')).toBeInTheDocument();
    expect(radio('English')).toBeChecked();
    expect(radio('日本語')).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Get started/ })).toBeInTheDocument();
    expect(screen.getByTestId('lang-pron-note')).toHaveTextContent('romanized Korean');
  });

  it('언어를 누르면 즉시 저장되고 이 화면 문구가 바로 바뀜 (JA → 가타카나 안내)', async () => {
    renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    fireEvent.click(radio('日本語'));
    expect(useAppStore.getState().lang).toBe('ja');
    expect(radio('日本語')).toBeChecked();
    expect(radio('English')).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('言語を選んでください');
    expect(screen.getByTestId('lang-pron-note')).toHaveTextContent('カタカナ');
    // 새로고침 후 유지(persist)
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"lang":"ja"');
  });

  it('ZH를 고르면 중국어 문구 + 로마자(병음 아님) 안내', async () => {
    renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    fireEvent.click(radio('简体中文'));
    expect(useAppStore.getState().lang).toBe('zh');
    expect(screen.getByTestId('lang-pron-note')).toHaveTextContent('拼音');
  });

  it('고르지 않고 시작하기 → 기본 언어(EN) 저장 후 홈', async () => {
    renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    fireEvent.click(screen.getByRole('button', { name: /Get started/ }));
    expect(useAppStore.getState().lang).toBe('en');
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
  });

  it('고른 언어로 시작하기 → 홈, 언어 유지', async () => {
    renderAt('/lang', 'en');
    await screen.findByTestId('screen-lang');
    fireEvent.click(radio('简体中文'));
    fireEvent.click(screen.getByRole('button', { name: /开始/ }));
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
    expect(useAppStore.getState().lang).toBe('zh');
  });

  it('탭바가 없고 화면에서 screen_view를 직접 기록하지 않음(라우터가 1회)', async () => {
    renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    expect(screen.queryByRole('navigation')).toBeNull();
    const views = useAppStore.getState().events.filter((e) => e.type === 'screen_view');
    expect(views).toHaveLength(1);
  });
});

describe('S00 언어 선택 — 네이티브 radio 그룹 (R1 M-01)', () => {
  // 방향키 이동·끝↔처음 순환·선택 항목 하나로만 Tab 진입은 같은 name의 네이티브 radio가 주는
  // 브라우저 기본 동작입니다. jsdom은 이 키보드 동작을 재현하지 않으므로 여기서는 그 전제
  // (같은 name의 radio 3개, 하나만 checked, change → 즉시 전환)를 검사합니다.
  it('같은 name의 radio 3개, 그룹 이름 = 안내 제목, 하나만 checked', async () => {
    renderAt('/lang', 'zh');
    await screen.findByTestId('screen-lang');
    const group = screen.getByRole('radiogroup', { name: '请选择语言' });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => r.type === 'radio' && r.name === 'lang-choose')).toBe(true);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(['zh']);
  });

  it('방향키 이동과 같은 change(다음 radio 선택) → store·문구 즉시 전환, 이전 항목 해제', async () => {
    renderAt('/lang', 'en');
    await screen.findByTestId('screen-lang');
    fireEvent.click(radio('日本語')); // 브라우저는 ArrowDown 시 다음 radio에 click/change를 보냄
    expect(useAppStore.getState().lang).toBe('ja');
    expect(radio('日本語')).toBeChecked();
    expect(radio('English')).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('言語を選んでください');
  });

  it('라벨(카드 전체)을 눌러도 선택 — 44px 카드가 클릭 영역', async () => {
    renderAt('/lang', 'en');
    await screen.findByTestId('screen-lang');
    fireEvent.click(screen.getByTestId('lang-zh'));
    expect(useAppStore.getState().lang).toBe('zh');
    expect(screen.getByTestId('lang-zh')).toHaveClass('lang-opt--on');
  });

  it('radio는 button이 아니고 별도 Tab 정지점(tabIndex) 조작 없음', async () => {
    renderAt('/lang', 'en');
    await screen.findByTestId('screen-lang');
    for (const r of screen.getAllByRole('radio')) {
      expect(r.tagName).toBe('INPUT');
      expect(r).not.toHaveAttribute('tabindex');
    }
    // 화면의 button은 시작하기와 장면 재생/일시정지뿐 (언어 항목이 Tab 순서에 3번 끼지 않음).
    // 장면 탭은 role=tab (T6.1)
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Get started/ })).toBeInTheDocument();
    expect(screen.getByTestId('lang-play')).toBeInTheDocument();
  });
});

/** prefers-reduced-motion 결과를 정함 (jsdom에는 matchMedia가 없음) */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reduce && query.includes('reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

const sceneOf = () => screen.getByTestId('lang-scene').getAttribute('data-scene');
const tab = (name: string) => screen.getByRole('tab', { name });
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('S00 인트로 — 기능 안내판 (T6.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('로고·제목·필요성 문장·하단 문구, 장면 탭 3개(tablist), 첫 장면 = 코스', () => {
    renderAt('/lang', 'en');
    expect(screen.getByTestId('screen-lang')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Edulleo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Daejeon, one detour at a time.',
    );
    expect(screen.getByText(/Edulleo takes care of the route/)).toBeInTheDocument();
    expect(screen.getByText('No app install · works offline')).toBeInTheDocument();
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['1Course', '2Order', '3Staff']);
    expect(tab('Course')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Order')).toHaveAttribute('aria-selected', 'false');
    expect(sceneOf()).toBe('course');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tab('Course').id);
    const cap = screen.getByTestId('lang-scene-cap');
    expect(cap).toHaveTextContent(/ready-made walking course/);
    // 강조(*…*)는 굵은 글자로, 별표는 보이지 않음
    expect(cap.querySelector('b')).toHaveTextContent('ready-made walking course');
    expect(cap.textContent).not.toContain('*');
  });

  it('약 4.4초마다 자동으로 다음 장면 (코스 → 주문 → 직원 → 코스)', () => {
    renderAt('/lang', 'en');
    expect(sceneOf()).toBe('course');
    advance(SCENE_MS - 10);
    expect(sceneOf()).toBe('course');
    advance(10);
    expect(sceneOf()).toBe('order');
    expect(tab('Order')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('lang-scene-cap')).toHaveTextContent(/tap what you want/);
    advance(SCENE_MS);
    expect(sceneOf()).toBe('staff');
    expect(screen.getByTestId('lang-scene-cap')).toHaveTextContent(/Show your screen/);
    advance(SCENE_MS);
    expect(sceneOf()).toBe('course');
  });

  it('장면 탭을 누르면 그 장면으로 이동하고 자동 재생이 멈춤', () => {
    renderAt('/lang', 'en');
    expect(screen.getByTestId('lang-play')).toHaveAccessibleName('Pause scenes');
    fireEvent.click(tab('Staff'));
    expect(sceneOf()).toBe('staff');
    expect(screen.getByTestId('lang-play')).toHaveAccessibleName('Play scenes');
    advance(SCENE_MS * 3);
    expect(sceneOf()).toBe('staff');
    // 자동 재생 중에는 설명을 읽어 주지 않고(off), 멈추면 polite
    expect(screen.getByTestId('lang-scene-cap')).toHaveAttribute('aria-live', 'polite');
  });

  it('재생/일시정지 버튼: 누르면 멈추고, 다시 누르면 이어서 자동 전환', () => {
    renderAt('/lang', 'en');
    const play = screen.getByTestId('lang-play');
    expect(screen.getByTestId('lang-scene-cap')).toHaveAttribute('aria-live', 'off');
    fireEvent.click(play);
    expect(play).toHaveAccessibleName('Play scenes');
    advance(SCENE_MS * 2);
    expect(sceneOf()).toBe('course');
    fireEvent.click(play);
    expect(play).toHaveAccessibleName('Pause scenes');
    advance(SCENE_MS);
    expect(sceneOf()).toBe('order');
  });

  it('키보드: 탭에서 → / ← / Home / End로 장면 이동(초점도 이동), 자동 재생 멈춤', () => {
    renderAt('/lang', 'en');
    const first = tab('Course');
    expect(first).toHaveAttribute('tabindex', '0');
    expect(tab('Order')).toHaveAttribute('tabindex', '-1');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(sceneOf()).toBe('order');
    expect(tab('Order')).toHaveFocus();
    fireEvent.keyDown(tab('Order'), { key: 'ArrowLeft' });
    fireEvent.keyDown(tab('Course'), { key: 'ArrowLeft' });
    expect(sceneOf()).toBe('staff');
    fireEvent.keyDown(tab('Staff'), { key: 'Home' });
    expect(sceneOf()).toBe('course');
    fireEvent.keyDown(tab('Course'), { key: 'End' });
    expect(sceneOf()).toBe('staff');
    expect(screen.getByTestId('lang-play')).toHaveAccessibleName('Play scenes');
    advance(SCENE_MS * 2);
    expect(sceneOf()).toBe('staff');
  });

  it('움직임 줄이기: 영상 없이 장면별 정지 그림, 자동 재생·재생 버튼 없음, 탭으로 이동만', () => {
    stubReducedMotion(true);
    renderAt('/lang', 'en');
    expect(screen.queryByTestId('lang-play')).toBeNull();
    expect(screen.queryByTestId('lang-video')).toBeNull();
    expect(loadIntroVideo).not.toHaveBeenCalled();
    expect(screen.getByTestId('lang-still')).toHaveAttribute('src', '/intro/scene-1.webp');
    advance(SCENE_MS * 3);
    expect(sceneOf()).toBe('course');
    fireEvent.click(tab('Order'));
    expect(sceneOf()).toBe('order');
    expect(screen.getByTestId('lang-still')).toHaveAttribute('src', '/intro/scene-2.webp');
    fireEvent.click(tab('Staff'));
    expect(screen.getByTestId('lang-still')).toHaveAttribute('src', '/intro/scene-3.webp');
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('.lang-tab__bar')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('영상을 못 쓰면(불러오기 실패) 정지 그림 + 4.4초 타이머로 장면 전환 (기존 동작 유지)', async () => {
    renderAt('/lang', 'en');
    await act(async () => {});
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'off');
    expect(screen.queryByTestId('lang-video')).toBeNull();
    expect(screen.getByTestId('lang-still')).toHaveAttribute('src', '/intro/scene-1.webp');
    advance(SCENE_MS);
    expect(sceneOf()).toBe('order');
    expect(screen.getByTestId('lang-still')).toHaveAttribute('src', '/intro/scene-2.webp');
  });

  it('언어를 바꾸면 장면 탭·설명·제목·재생 버튼 이름이 즉시 그 언어로 (JA·ZH)', () => {
    renderAt('/lang', null);
    fireEvent.click(screen.getByRole('radio', { name: '日本語' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('大田を、もう一歩先へ。');
    expect(screen.getByRole('tab', { name: 'コース' })).toBeInTheDocument();
    expect(screen.getByTestId('lang-scene-cap')).toHaveTextContent('おすすめコース');
    expect(screen.getByTestId('lang-play')).toHaveAccessibleName('場面の再生を一時停止');
    fireEvent.click(screen.getByRole('radio', { name: '简体中文' }));
    expect(screen.getByRole('tab', { name: '店员' })).toBeInTheDocument();
    expect(screen.getByText('无需安装 · 离线也能用')).toBeInTheDocument();
    expect(useAppStore.getState().lang).toBe('zh');
  });

  it('화면을 떠나면 타이머 정리 (시작하기 후 남은 타이머 없음)', () => {
    renderAt('/lang', 'en');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Get started/ }));
    expect(screen.getByTestId('screen-home')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('S00 인트로 — 영상 (T6.16)', () => {
  // jsdom은 재생을 구현하지 않으므로 재생 위치·play·pause를 흉내 냄
  let play: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let pause: ReturnType<typeof vi.fn<() => void>>;
  const times = new WeakMap<HTMLMediaElement, number>();
  const origTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(loadIntroVideo).mockResolvedValue('blob:intro');
    play = vi.fn<() => Promise<void>>(() => Promise.resolve());
    pause = vi.fn<() => void>();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get(this: HTMLMediaElement) {
        return times.get(this) ?? 0;
      },
      set(this: HTMLMediaElement, v: number) {
        times.set(this, v);
      },
    });
  });
  afterEach(() => {
    vi.mocked(loadIntroVideo).mockResolvedValue(null);
    vi.restoreAllMocks();
    if (origTime) Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', origTime);
  });

  /** 영상이 준비될 때까지 */
  async function ready() {
    renderAt('/lang', 'en');
    await act(async () => {});
    const v = screen.getByTestId('lang-video') as HTMLVideoElement;
    fireEvent.canPlay(v);
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'on');
    return v;
  }
  const at = (v: HTMLVideoElement, s: number) => {
    v.currentTime = s;
    advance(INTRO_POLL_MS);
  };

  it('준비되면 정지 그림 대신 무음 영상이 반복 재생, 영상 시간이 장면을 정함(타이머 아님)', async () => {
    const v = await ready();
    expect(v.muted).toBe(true);
    expect(v).toHaveAttribute('playsinline');
    expect(v.loop).toBe(true);
    expect(play).toHaveBeenCalled();
    expect(screen.queryByTestId('lang-still')).toBeNull();
    // 타이머로는 넘어가지 않음
    advance(SCENE_MS);
    expect(sceneOf()).toBe('course');
    at(v, 4.5);
    expect(sceneOf()).toBe('order');
    at(v, 9.0);
    expect(sceneOf()).toBe('staff');
    at(v, 0.2); // 반복 재생으로 처음
    expect(sceneOf()).toBe('course');
  });

  it('탭을 누르면 그 장면 시작점으로 이동해 그 장면만 재생하고 끝 모습에서 멈춤, 자동 재생 멈춤', async () => {
    const v = await ready();
    fireEvent.click(tab('Staff'));
    expect(sceneOf()).toBe('staff');
    expect(v.currentTime).toBeCloseTo(8.8, 1);
    expect(v.loop).toBe(false);
    pause.mockClear();
    at(v, 13.18);
    expect(pause).toHaveBeenCalled();
    expect(sceneOf()).toBe('staff');
    fireEvent.click(tab('Order'));
    expect(v.currentTime).toBeCloseTo(4.4, 1);
    expect(sceneOf()).toBe('order');
  });

  it('일시정지 버튼: 영상 멈춤, 다시 누르면 멈춘 곳부터 반복 재생 + 장면 자동 이동', async () => {
    const v = await ready();
    at(v, 5.0);
    expect(sceneOf()).toBe('order');
    fireEvent.click(screen.getByTestId('lang-play'));
    expect(pause).toHaveBeenCalled();
    play.mockClear();
    fireEvent.click(screen.getByTestId('lang-play'));
    expect(play).toHaveBeenCalled();
    expect(v.currentTime).toBe(5.0);
    at(v, 9.1);
    expect(sceneOf()).toBe('staff');
  });

  it('재생이 거부되면 정지 그림으로 돌아가고 타이머가 다시 장면을 넘김', async () => {
    play.mockImplementation(() => Promise.reject(new Error('NotAllowed')));
    renderAt('/lang', 'en');
    await act(async () => {});
    fireEvent.canPlay(screen.getByTestId('lang-video'));
    await act(async () => {});
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'off');
    expect(screen.getByTestId('lang-still')).toBeInTheDocument();
    advance(SCENE_MS);
    expect(sceneOf()).toBe('order');
  });

  it('화면을 떠나면 확인 타이머 정리', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: /Get started/ }));
    expect(screen.getByTestId('screen-home')).toBeInTheDocument();
    advance(1); // React 예약 작업(setTimeout 0) 소진
    expect(vi.getTimerCount()).toBe(0);
  });

  it('장면 끝을 늦게 확인해 다음 장면으로 넘어갔어도 고른 장면 끝 모습으로 되돌려 멈춤 (R1 M-03)', async () => {
    const v = await ready();
    fireEvent.click(tab('Order'));
    pause.mockClear();
    at(v, 9.36); // 메인 스레드 지연으로 직원 장면까지 진행
    expect(pause).toHaveBeenCalled();
    expect(v.currentTime).toBeGreaterThan(4.4);
    expect(v.currentTime).toBeLessThan(8.8);
    expect(sceneOf()).toBe('order');
  });

  it('재생 요청 중 일시정지로 play()가 취소(AbortError)돼도 실패로 보지 않음, 다시 재생하면 영상 그대로 (R1 M-02)', async () => {
    let rejectPlay: (e: unknown) => void = () => {};
    play.mockImplementation(
      () =>
        new Promise<void>((_res, rej) => {
          rejectPlay = rej;
        }),
    );
    const v = await ready();
    fireEvent.click(screen.getByTestId('lang-play')); // 일시정지
    await act(async () => {
      rejectPlay(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'));
    });
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'on');
    play.mockClear();
    fireEvent.click(screen.getByTestId('lang-play')); // 다시 재생
    expect(play).toHaveBeenCalled();
    at(v, 4.6);
    expect(sceneOf()).toBe('order');
  });

  it('재생 중 브라우저가 play()를 취소(AbortError, 예: 위치 이동)해도 영상 유지 — 진짜 거부만 실패 (R1 M-02)', async () => {
    let rejectPlay: (e: unknown) => void = () => {};
    play.mockImplementation(
      () =>
        new Promise<void>((_res, rej) => {
          rejectPlay = rej;
        }),
    );
    await ready();
    await act(async () => {
      rejectPlay(new DOMException('interrupted by a new load request', 'AbortError'));
    });
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'on');
  });

  it('영상이 늦게 준비되는 동안 정지 그림 타이머로 넘어간 장면·일시정지 상태를 영상이 이어받음 (R1 M-04)', async () => {
    renderAt('/lang', 'en');
    await act(async () => {});
    const v = screen.getByTestId('lang-video') as HTMLVideoElement; // 받았지만 아직 재생 준비 전
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'off');
    advance(SCENE_MS); // 정지 그림 + 타이머로 주문 장면
    expect(sceneOf()).toBe('order');
    fireEvent.click(screen.getByTestId('lang-play')); // 일시정지
    pause.mockClear();
    fireEvent.canPlay(v);
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'on');
    expect(v.currentTime).toBeCloseTo(4.4, 1); // 주문 장면 시작점
    expect(pause).toHaveBeenCalled();
    expect(sceneOf()).toBe('order');
  });

  it('진행 막대는 영상 시간의 장면 안 진행률을 따름 (R1 L-03)', async () => {
    const v = await ready();
    at(v, 6.6); // 주문 장면의 절반
    const bar = screen.getByTestId('lang-tab-bar');
    expect(bar).toHaveClass('lang-tab__bar--video');
    expect(bar.style.transform).toBe('scaleX(0.5)');
  });

  it('움직임 줄이기를 켰다 끄면 영상을 새로 불러와 다시 재생 (R1 M-01)', async () => {
    const listeners = new Set<() => void>();
    let reduce = false;
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return reduce && query.includes('reduce');
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }));
    const flip = (on: boolean) =>
      act(() => {
        reduce = on;
        listeners.forEach((fn) => fn());
      });
    await ready();
    expect(loadIntroVideo).toHaveBeenCalledTimes(1);
    flip(true);
    expect(screen.queryByTestId('lang-video')).toBeNull();
    expect(screen.getByTestId('lang-still')).toBeInTheDocument();
    expect(releaseIntroVideo).toHaveBeenCalledWith('blob:intro');
    flip(false);
    await act(async () => {});
    expect(loadIntroVideo).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'off'); // 새 영상 준비 전에는 쓰지 않음
    fireEvent.canPlay(screen.getByTestId('lang-video'));
    expect(screen.getByTestId('lang-stage')).toHaveAttribute('data-video', 'on');
  });

  it('StrictMode(효과 두 번)에서도 동작하고, 떠나면 받은 blob URL을 모두 해제', async () => {
    useAppStore.setState({ lang: 'en', events: [] });
    const r = render(
      <StrictMode>
        <MemoryRouter initialEntries={['/lang']}>
          <AppRoutes />
        </MemoryRouter>
      </StrictMode>,
    );
    await act(async () => {});
    const v = screen.getByTestId('lang-video') as HTMLVideoElement;
    fireEvent.canPlay(v);
    at(v, 9.0);
    expect(sceneOf()).toBe('staff');
    r.unmount();
    // 받은 URL 수 = 해제한 URL 수 (StrictMode의 첫 불러오기 결과도 버리며 해제)
    const loaded = vi.mocked(loadIntroVideo).mock.calls.length;
    expect(vi.mocked(releaseIntroVideo).mock.calls.filter(([u]) => u === 'blob:intro')).toHaveLength(loaded);
  });

  it('CSS: 영상 칸 232px, 영상·정지 그림은 칸을 꽉 채움(object-fit: cover)', () => {
    const css = readLangCss();
    expect(parseRules(css).get('.lang-stage')?.get('height')).toBe('232px');
    expect(css).toMatch(/\.lang-still,\s*\.lang-video\s*\{[^}]*object-fit:\s*cover/);
  });
});

// jsdom 환경에서는 import.meta.url이 file: 주소가 아니라 vitest 실행 위치(app/) 기준으로 읽음
function readLangCss(): string {
  return readFileSync(resolve(process.cwd(), 'src/screens/Lang/lang.css'), 'utf8');
}

describe('S00 인트로 — 색 규칙', () => {
  const rules = parseRules(readLangCss());
  it('앰버(--signal)는 글자색으로 쓰지 않음 (진행 막대·강조 밑줄만)', () => {
    for (const [sel, decls] of rules) {
      expect(`${sel} color: ${decls.get('color') ?? ''}`).not.toMatch(/color: var\(--signal\)/);
    }
  });
});
