import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../router/AppRoutes';
import { STORAGE_KEY, useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, parseRules, parseTokens, resolveColor } from '../../ui/a11y';
import { SCENE_MS } from './index';

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

  it('움직임 줄이기: 자동 재생·재생 버튼 없음, 장면 탭으로 이동만, 장면은 마지막 모습', () => {
    stubReducedMotion(true);
    const { container } = renderAt('/lang', 'en');
    expect(screen.getByTestId('screen-lang')).toHaveClass('lang-screen--still');
    expect(screen.queryByTestId('lang-play')).toBeNull();
    advance(SCENE_MS * 3);
    expect(sceneOf()).toBe('course');
    fireEvent.click(tab('Order'));
    expect(sceneOf()).toBe('order');
    // 타이머 없이 바로 주문 카드가 보이는 상태
    expect(container.querySelector('.lang-scene--order .lo-card')).toHaveClass('is-on');
    fireEvent.click(tab('Staff'));
    expect(container.querySelector('.lang-scene--staff .ls-bubble')).toHaveClass('is-on');
    expect(container.querySelector('.lang-tab__bar')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('주문 장면 안 움직임(자동 재생 중): 수량이 오르고 주문 카드가 나타남(그림에 메뉴 문구 없음)', () => {
    const { container } = renderAt('/lang', 'en');
    advance(SCENE_MS); // 자동 전환으로 주문 장면 (탭을 누르면 일시정지되어 정적 모습)
    expect(sceneOf()).toBe('order');
    const card = () => container.querySelector('.lang-scene--order .lo-card');
    expect(card()).not.toHaveClass('is-on');
    expect(screen.getByTestId('screen-lang')).not.toHaveClass('lang-screen--still');
    advance(2100);
    expect(card()).toHaveClass('is-on');
    const counts = [...container.querySelectorAll('.lang-scene--order .lo-step b')].map(
      (b) => b.textContent,
    );
    expect(counts).toEqual(['1', '2', '0']);
    expect(container.querySelector('.lang-stage')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.lang-scene--order')?.textContent).toMatch(/^[−+\d]*$/);
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

describe('S00 인트로 — 일시정지 시 장면 안 움직임 정지 (R1 M-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('주문 장면에서 일시정지 → 단계 타이머 없음, 정적 마지막 모습, 반복 파형 정지 클래스', () => {
    const { container } = renderAt('/lang', 'en');
    advance(SCENE_MS + 600); // 자동 재생으로 주문 장면, 단계 진행 중
    expect(sceneOf()).toBe('order');
    expect(container.querySelector('.lang-scene--order .lo-card')).not.toHaveClass('is-on');
    fireEvent.click(screen.getByTestId('lang-play'));
    // 정지: 남은 타이머 없음(장면 전환·장면 안 단계 모두), 카드가 보이는 마지막 모습
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('.lang-scene--order .lo-card')).toHaveClass('is-on');
    expect(screen.getByTestId('screen-lang')).toHaveClass('lang-screen--still');
    expect(container.querySelector('.lang-tab__bar')).toBeNull();
    // 다시 재생하면 정지 클래스가 빠지고 타이머가 다시 돎
    fireEvent.click(screen.getByTestId('lang-play'));
    expect(screen.getByTestId('screen-lang')).not.toHaveClass('lang-screen--still');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('장면 탭으로 고르면(자동 재생 멈춤) 직원 장면도 타이머 없이 정적 마지막 모습', () => {
    const { container } = renderAt('/lang', 'en');
    fireEvent.click(tab('Staff'));
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('.lang-scene--staff .ls-bubble')).toHaveClass('is-on');
    expect(container.querySelector('.lang-scene--staff .ls-phone')).not.toHaveClass('is-turned');
  });

  it('CSS: 정지 상태에서 반복 파형·물결·코스 그리기 애니메이션을 끔', () => {
    const rules = parseRules(readLangCss());
    expect(rules.get('.lang-screen--still .lo-card.is-on .lo-w i')?.get('animation')).toBe('none');
    expect(rules.get('.lang-screen--still .lo-step em.lo-tap::after')?.get('animation')).toBe(
      'none',
    );
    expect(rules.get('.lang-screen--still .lc-run')?.get('animation')).toBe('none');
    expect(rules.get('.lang-screen--still .lc-pop')?.get('opacity')).toBe('1');
  });
});

// jsdom 환경에서는 import.meta.url이 file: 주소가 아니라 vitest 실행 위치(app/) 기준으로 읽음
function readLangCss(): string {
  return readFileSync(resolve(process.cwd(), 'src/screens/Lang/lang.css'), 'utf8');
}

/** '#rrggbb' 또는 'rgba(r,g,b,a)' 위에 겹친 색 → 불투명 #rrggbb */
function over(top: string, bottom: string): string {
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(top);
  if (!rgba) return top;
  const a = Number(rgba[4]);
  const b = bottom.replace('#', '');
  const ch = (i: number) =>
    Math.round(Number(rgba[i + 1]) * a + parseInt(b.slice(i * 2, i * 2 + 2), 16) * (1 - a));
  return '#' + [0, 1, 2].map((i) => ch(i).toString(16).padStart(2, '0')).join('');
}

describe('S00 인트로 — 주문 그림 수량·기호 대비 (R1 M-02)', () => {
  const tokens = parseTokens(readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8'));
  const rules = parseRules(readLangCss());
  const color = (sel: string, prop: string) => {
    const v = rules.get(sel)?.get(prop);
    if (!v) throw new Error(`${sel} ${prop} 없음`);
    return resolveColor(v, tokens);
  };
  // 실제 합성: 안내판(--blue) → 무대(.lang-stage) → 행(.lo-row)
  const board = color('.lang-board', 'background');
  const stage = over(color('.lang-stage', 'background'), board);
  const row = over(color('.lo-row', 'background'), stage);

  it.each([
    ['수량 0', '.lo-step b'],
    ['수량 양수', '.lo-step b.lo-n'],
    ['+/− 기호', '.lo-step em'],
  ])('%s 글자 / 합성 행 배경 ≥ 4.5:1', (_name, sel) => {
    expect(contrastRatio(color(sel, 'color'), row)).toBeGreaterThanOrEqual(4.5);
  });

  it('앰버(--signal)는 글자색으로 쓰지 않음 (진행 막대·강조 밑줄·그림 선만)', () => {
    for (const [sel, decls] of rules) {
      expect(`${sel} color: ${decls.get('color') ?? ''}`).not.toMatch(/color: var\(--signal\)/);
    }
  });
});
