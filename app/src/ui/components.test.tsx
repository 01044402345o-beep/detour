import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Tts } from '../speech/tts';
import { useAppStore } from '../store/useAppStore';
import { TOUCH_SELECTORS } from './a11y';
import {
  Button,
  Card,
  CardButton,
  Icon,
  IconButton,
  ListenButton,
  Pill,
  Pronunciation,
  Sheet,
  TabBar,
  TOAST_MS,
  ToastProvider,
  TopBar,
  pickPronunciation,
  useToast,
} from '.';

beforeEach(() => useAppStore.setState({ lang: 'en' }));
afterEach(() => {
  useAppStore.setState({ lang: null });
  vi.useRealTimers();
});

const stubTts: Tts = {
  init: () => Promise.resolve('ready'),
  getState: () => 'ready',
  speak: () => 'started',
  cancel: () => {},
  bindAutoCancel: () => () => {},
};

describe('Button·Pill·Card·IconButton·Icon', () => {
  it('Button: 변형 클래스, type=button 기본, 비활성', () => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant="acc" icon="mic" onClick={onClick}>
          go
        </Button>
        <Button disabled>off</Button>
      </>,
    );
    const go = screen.getByRole('button', { name: 'go' });
    expect(go).toHaveClass('ui-btn', 'ui-btn--acc');
    expect(go).toHaveAttribute('type', 'button');
    fireEvent.click(go);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'off' })).toBeDisabled();
  });

  it('Pill·Card는 누를 수 없는 요소, CardButton은 button', () => {
    render(
      <>
        <Pill tone="sea">p</Pill>
        <Card data-testid="c">c</Card>
        <CardButton>cb</CardButton>
      </>,
    );
    expect(screen.getByText('p')).toHaveClass('ui-pill', 'ui-pill--sea');
    expect(screen.getByTestId('c').tagName).toBe('DIV');
    expect(screen.getByRole('button', { name: 'cb' })).toHaveClass('ui-card--action');
  });

  it('IconButton: aria-label 필수, 아이콘은 aria-hidden', () => {
    render(<IconButton icon="close" label="X" />);
    const b = screen.getByRole('button', { name: 'X' });
    expect(b).toHaveClass('ui-icb');
    expect(b.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Icon: 크기 지정', () => {
    const { container } = render(<Icon name="speaker" size={30} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '30');
  });
});

describe('터치 영역: 누를 수 있는 공용 요소는 44px 클래스를 가짐', () => {
  it('Button·IconButton·CardButton·ListenButton·TopBar·TabBar·Sheet 닫기', () => {
    render(
      <MemoryRouter>
        <Button>b</Button>
        <IconButton icon="plus" label="i" />
        <CardButton>c</CardButton>
        <ListenButton text="네" variant="bare" label="l" tts={stubTts} />
        <TopBar title="t" />
        <TabBar />
        <Sheet open onClose={() => {}} title="s" />
      </MemoryRouter>,
    );
    const clickable = [...screen.getAllByRole('button'), ...screen.getAllByRole('link')];
    expect(clickable).toHaveLength(11); // 버튼 6 + 탭 링크 5
    for (const el of clickable) {
      const ok = TOUCH_SELECTORS.some((sel) => el.matches(sel));
      expect(ok, el.outerHTML.slice(0, 80)).toBe(true);
    }
  });
});

describe('TopBar', () => {
  it('뒤로: 앱 안 이전 화면이 없으면 backTo로', () => {
    render(
      <MemoryRouter initialEntries={['/order']}>
        <Routes>
          <Route path="/order" element={<TopBar title="My order" backTo="/place/ssd" />} />
          <Route path="/place/:id" element={<p>place</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'My order' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('place')).toBeInTheDocument();
  });

  it('onBack 지정·뒤로 숨김·오른쪽 자리', () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <TopBar onBack={onBack} right={<IconButton icon="flag" label="r" />} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'r' })).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <TopBar showBack={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});

describe('TabBar', () => {
  it('탭 5개, 현재 탭 표시, 언어 전환', () => {
    render(
      <MemoryRouter initialEntries={['/phrases']}>
        <TabBar />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Explore',
      'Course',
      'Phrases',
      'Saved',
      'Settings',
    ]);
    expect(screen.getByRole('link', { name: 'Phrases' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explore' })).not.toHaveAttribute('aria-current');
    act(() => useAppStore.getState().setLang('zh'));
    expect(screen.getAllByRole('link')[0].textContent).not.toBe('Explore');
  });
});

describe('Sheet', () => {
  it('닫혀 있으면 아무것도 그리지 않음', () => {
    render(<Sheet open={false} onClose={() => {}} title="s" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('열리면 dialog·제목·포커스, Esc·바탕·닫기 버튼으로 닫힘', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="What is different?">
        <button type="button">inside</button>
      </Sheet>,
    );
    const dlg = screen.getByRole('dialog', { name: 'What is different?' });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(dlg).toHaveFocus();
    fireEvent.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('sheet-dim'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('#app-overlay가 있으면 그 안에 그림, 닫히면 포커스를 돌려줌', () => {
    const overlay = document.createElement('div');
    overlay.id = 'app-overlay';
    document.body.appendChild(overlay);
    function Host({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">opener</button>
          <Sheet open={open} onClose={() => {}} title="s" />
        </>
      );
    }
    const { rerender } = render(<Host open={false} />);
    screen.getByText('opener').focus();
    rerender(<Host open />);
    expect(overlay).toContainElement(screen.getByRole('dialog'));
    rerender(<Host open={false} />);
    expect(screen.getByText('opener')).toHaveFocus();
    overlay.remove();
  });
});

describe('Sheet R1: 이름·배경 inert·Tab 순환', () => {
  /** 앱 틀 흉내: main.app-view · 탭바 · 토스트 영역 · #app-overlay 형제 */
  function frame() {
    const f = document.createElement('div');
    f.innerHTML =
      '<main class="app-view"><button id="bg">bg</button></main><nav class="ui-tabbar"></nav>' +
      '<div role="status"></div><div id="app-overlay"></div>';
    document.body.appendChild(f);
    return {
      main: f.querySelector('main')!,
      nav: f.querySelector('nav')!,
      status: f.querySelector('[role=status]')!,
      remove: () => f.remove(),
    };
  }

  it('L01: label 형태는 aria-label로 이름, 제목 h2 없음', () => {
    render(<Sheet open onClose={() => {}} label="Confirm" />);
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('L01: 이름 없는 Sheet는 타입 오류', () => {
    // @ts-expect-error title 또는 label 중 하나 필수
    const el = <Sheet open={false} onClose={() => {}} />;
    expect(el).toBeTruthy();
  });

  it('열린 동안 배경(app-view·탭바)만 inert, 닫히면 해제 후 포커스 복귀', () => {
    const f = frame();
    const bg = f.main.querySelector('button')!;
    bg.focus();
    const { rerender } = render(<Sheet open onClose={() => {}} title="s" />);
    expect(f.main).toHaveAttribute('inert');
    expect(f.nav).toHaveAttribute('inert');
    expect(f.status).not.toHaveAttribute('inert');
    rerender(<Sheet open={false} onClose={() => {}} title="s" />);
    expect(f.main).not.toHaveAttribute('inert');
    expect(f.nav).not.toHaveAttribute('inert');
    expect(bg).toHaveFocus();
    f.remove();
  });

  it('두 시트가 겹치면 마지막이 닫힐 때만 해제, Esc는 맨 위 시트만', () => {
    const f = frame();
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(
      <>
        <Sheet open onClose={a} title="A" />
        <Sheet open onClose={b} title="B" />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    rerender(
      <>
        <Sheet open onClose={a} title="A" />
        <Sheet open={false} onClose={b} title="B" />
      </>,
    );
    expect(f.main).toHaveAttribute('inert');
    rerender(
      <>
        <Sheet open={false} onClose={a} title="A" />
        <Sheet open={false} onClose={b} title="B" />
      </>,
    );
    expect(f.main).not.toHaveAttribute('inert');
    f.remove();
  });

  it('Tab: 마지막 → 첫 요소, Shift+Tab: 첫 요소·시트 → 마지막', () => {
    render(
      <Sheet open onClose={() => {}} title="s">
        <button type="button">one</button>
        <button type="button" disabled>
          off
        </button>
        <button type="button">two</button>
      </Sheet>,
    );
    const dlg = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    const two = screen.getByRole('button', { name: 'two' });
    expect(dlg).toHaveFocus();
    // 시트 자체에서 Shift+Tab → 마지막
    expect(fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(two).toHaveFocus();
    // 마지막(비활성 제외)에서 Tab → 첫 요소(닫기)
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
    expect(close).toHaveFocus();
    // 첫 요소에서 Shift+Tab → 마지막
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(two).toHaveFocus();
    // 중간에서는 브라우저 기본 이동 (preventDefault 안 함)
    screen.getByRole('button', { name: 'one' }).focus();
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(true);
  });
});

describe('Sheet R2-L02: 겹침 미지원', () => {
  it('두 번째 시트가 열리면 DEV 경고 1회 (동작은 막지 않음)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <Sheet open onClose={() => {}} title="A" />
      </>,
    );
    expect(warn).not.toHaveBeenCalled();
    render(<Sheet open onClose={() => {}} title="B" />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2);
    warn.mockRestore();
  });
});

describe('trapTab: 포커스 가능 요소가 없으면 컨테이너 유지', () => {
  it('Tab을 막고 컨테이너에 포커스', async () => {
    const { trapTab } = await import('./overlay');
    const root = document.createElement('div');
    root.tabIndex = -1;
    root.innerHTML = '<p>text</p><button disabled>x</button>';
    document.body.appendChild(root);
    const e = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    expect(trapTab(e, root)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(root).toHaveFocus();
    root.remove();
  });
});

describe('Toast', () => {
  function Shower({ msg }: { msg: string }) {
    const toast = useToast();
    return (
      <button type="button" onClick={() => toast(msg)}>
        show
      </button>
    );
  }

  it('알림 영역(role=status)에 표시 후 2.4초 뒤 사라짐', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Shower msg="Coming soon" />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
    fireEvent.click(screen.getByText('show'));
    expect(region).toHaveTextContent('Coming soon');
    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(region).toHaveTextContent('Coming soon');
    act(() => vi.advanceTimersByTime(1));
    expect(region).toBeEmptyDOMElement();
  });

  it('새 토스트가 이전 것을 바꾸고 시간을 다시 잼', () => {
    vi.useFakeTimers();
    function Two() {
      const toast = useToast();
      return (
        <>
          <button type="button" onClick={() => toast('A')}>
            a
          </button>
          <button type="button" onClick={() => toast('B')}>
            b
          </button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Two />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('a'));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByText('b'));
    expect(screen.getByRole('status')).toHaveTextContent(/^B$/);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('status')).toHaveTextContent('B');
  });

  it('Provider 밖에서 useToast는 오류', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Shower msg="x" />)).toThrow();
    err.mockRestore();
  });
});

describe('Pronunciation (F-01)', () => {
  const p = { roman: 'twigim-sobororeul juseyo', kana: 'ティギムソボロルル チュセヨ' };

  it('EN·ZH는 로마자, JA는 가타카나 (현재 언어를 따름)', () => {
    const { container } = render(<Pronunciation {...p} />);
    const el = () => container.querySelector('.ui-pron')!;
    expect(el()).toHaveTextContent(p.roman);
    expect(el()).toHaveAttribute('data-pron', 'roman');
    act(() => useAppStore.getState().setLang('zh'));
    expect(el()).toHaveTextContent(p.roman);
    act(() => useAppStore.getState().setLang('ja'));
    expect(el()).toHaveTextContent(p.kana);
    expect(el()).toHaveAttribute('lang', 'ja');
  });

  it('lang 지정·문자열 헬퍼', () => {
    render(<Pronunciation {...p} lang="ja" />);
    expect(screen.getByText(p.kana)).toBeInTheDocument();
    expect(pickPronunciation('en', p)).toBe(p.roman);
    expect(pickPronunciation('zh', p)).toBe(p.roman);
    expect(pickPronunciation('ja', p)).toBe(p.kana);
  });
});
