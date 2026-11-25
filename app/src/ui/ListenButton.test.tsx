import { act, fireEvent, render, screen } from '@testing-library/react';
import type { SpeakResult, Tts } from '../speech/tts';
import { useAppStore } from '../store/useAppStore';
import type { TtsState } from '../types';
import { ListenButton } from './ListenButton';

/** T1.5 onEnd 계약을 따르는 가짜 TTS: 선점·cancel 시 이전 요청 onEnd를 동기로 1회 */
function fakeTts(initial: TtsState | null = null, result: SpeakResult = 'started') {
  let state = initial;
  let current: (() => void) | null = null;
  let resolveInit: (s: TtsState) => void = () => {};
  const finishCurrent = () => {
    const c = current;
    current = null;
    c?.();
  };
  const tts = {
    init: vi.fn(
      () =>
        new Promise<TtsState>((r) => {
          resolveInit = (s) => {
            state = s;
            r(s);
          };
        }),
    ),
    getState: vi.fn(() => state),
    speak: vi.fn((_text: string, _rate?: 1 | 0.75, onEnd?: () => void): SpeakResult => {
      if (result !== 'started') return result;
      const prev = current;
      current = onEnd ?? null;
      prev?.(); // 새 발화를 넣은 뒤 선점된 이전 onEnd
      return 'started';
    }),
    cancel: vi.fn(() => finishCurrent()),
    bindAutoCancel: vi.fn(() => () => {}),
  } satisfies Tts;
  return {
    tts,
    resolveInit: (s: TtsState) => act(async () => resolveInit(s)),
    end: () => act(() => finishCurrent()),
  };
}

beforeEach(() => useAppStore.setState({ lang: 'en' }));
afterEach(() => useAppStore.setState({ lang: null }));

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('ListenButton TTS 계약 ① 마운트 시 init → getState로 안내 갱신', () => {
  it('마운트하면 init을 1회 부르고, 결과에 따라 안내 표시', async () => {
    const f = fakeTts(null);
    render(<ListenButton text="안녕하세요" tts={f.tts} />);
    expect(f.tts.init).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('note')).toBeNull();
    await f.resolveInit('no-korean-voice');
    expect(screen.getByRole('note')).toHaveTextContent(
      'Korean voice is not available on this device.',
    );
  });

  it('ready면 안내 없음', async () => {
    const f = fakeTts(null);
    render(<ListenButton text="네" tts={f.tts} />);
    await f.resolveInit('ready');
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('unsupported면 버튼 비활성 + 미지원 안내', () => {
    const f = fakeTts('unsupported');
    render(<ListenButton text="네" tts={f.tts} />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Audio playback is not supported in this browser.',
    );
  });

  it('언마운트 뒤 도착한 init 결과는 무시 (getState를 다시 읽지 않음)', async () => {
    const f = fakeTts(null);
    const { unmount } = render(<ListenButton text="네" tts={f.tts} />);
    const before = f.tts.getState.mock.calls.length;
    unmount();
    await f.resolveInit('no-korean-voice');
    expect(f.tts.getState.mock.calls.length).toBe(before);
  });

  it('showNotice=false면 안내를 그리지 않음', async () => {
    const f = fakeTts(null);
    render(<ListenButton text="네" tts={f.tts} showNotice={false} />);
    await f.resolveInit('no-korean-voice');
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('② 탭 핸들러에서 init을 기다리지 않고 speak를 동기 호출', () => {
  it('init이 끝나기 전에 눌러도 그 자리에서 speak(text, rate)', () => {
    const f = fakeTts(null);
    render(<ListenButton text="튀김소보로 주세요" rate={0.75} tts={f.tts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Listen slowly' }));
    expect(f.tts.speak).toHaveBeenCalledTimes(1);
    expect(f.tts.speak.mock.calls[0][0]).toBe('튀김소보로 주세요');
    expect(f.tts.speak.mock.calls[0][1]).toBe(0.75);
    expect(pressed('Listen slowly')).toBe('true');
  });

  it("onPlay는 'started'일 때만, 실패면 재생 표시를 바로 끔", () => {
    const ok = fakeTts('ready');
    const onPlay = vi.fn();
    const { unmount } = render(<ListenButton text="네" tts={ok.tts} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onPlay).toHaveBeenCalledTimes(1);
    unmount();

    const blocked = fakeTts('ready', 'not-user-gesture');
    const onPlay2 = vi.fn();
    render(<ListenButton text="네" tts={blocked.tts} onPlay={onPlay2} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onPlay2).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('③ onEnd는 자기 요청의 재생 표시만 끔', () => {
  it('끝나면 재생 표시 끔', () => {
    const f = fakeTts('ready');
    render(<ListenButton text="네" tts={f.tts} />);
    fireEvent.click(screen.getByRole('button'));
    expect(pressed('Listen')).toBe('true');
    f.end();
    expect(pressed('Listen')).toBe('false');
  });

  it('같은 버튼을 다시 누르면 선점된 이전 요청의 onEnd가 와도 재생 표시 유지', () => {
    const f = fakeTts('ready');
    render(<ListenButton text="네" tts={f.tts} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(f.tts.speak).toHaveBeenCalledTimes(2);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    f.end();
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('다른 버튼이 선점하면 이전 버튼만 꺼짐', () => {
    const f = fakeTts('ready');
    render(
      <>
        <ListenButton text="하나" label="A" tts={f.tts} />
        <ListenButton text="둘" label="B" tts={f.tts} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(pressed('A')).toBe('false');
    expect(pressed('B')).toBe('true');
  });
});

describe('④ 화면 이탈(언마운트) cleanup에서 cancel', () => {
  it('재생 중이면 cancel', () => {
    const f = fakeTts('ready');
    const { unmount } = render(<ListenButton text="네" tts={f.tts} />);
    fireEvent.click(screen.getByRole('button'));
    unmount();
    expect(f.tts.cancel).toHaveBeenCalledTimes(1);
  });

  it('재생 중이 아니면 다른 버튼의 재생을 건드리지 않음', () => {
    const f = fakeTts('ready');
    const { unmount } = render(<ListenButton text="네" tts={f.tts} />);
    fireEvent.click(screen.getByRole('button'));
    f.end();
    unmount();
    expect(f.tts.cancel).not.toHaveBeenCalled();
  });

  it('ListenButton은 bindAutoCancel을 부르지 않음 (App.tsx에서 1회)', () => {
    const f = fakeTts('ready');
    render(<ListenButton text="네" tts={f.tts} />);
    fireEvent.click(screen.getByRole('button'));
    expect(f.tts.bindAutoCancel).not.toHaveBeenCalled();
  });
});

describe('모양·문구', () => {
  it('pill은 아이콘+보이는 문구, 언어 전환을 따름', () => {
    const f = fakeTts('ready');
    render(<ListenButton text="네" variant="pill" tts={f.tts} />);
    expect(screen.getByRole('button')).toHaveTextContent('Listen');
    act(() => useAppStore.getState().setLang('ja'));
    expect(screen.getByRole('button').textContent).not.toBe('Listen');
  });

  it('bare + children: 단어 칩처럼 감싸 쓰기', () => {
    const f = fakeTts('ready');
    render(
      <ListenButton text="주세요" variant="bare" label="주세요" tts={f.tts}>
        <b>주세요</b>
      </ListenButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: '주세요' }));
    expect(f.tts.speak.mock.calls[0][0]).toBe('주세요');
    expect(screen.getByRole('button')).toHaveClass('ui-listen');
    expect(screen.getByRole('button')).not.toHaveClass('ui-listen--round');
  });
});
