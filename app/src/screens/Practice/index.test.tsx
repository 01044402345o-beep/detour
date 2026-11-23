import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { getPlace } from '../../data';
import { buildOrderSentence, toOrderLines } from '../../domain/orderSentence';
import { phraseInput } from '../../router/navState';
import { PATHS } from '../../router/routes';
import { STT_REQUEST_TIMEOUT_MS, STT_TIMEOUT_MS, type RecognitionCtor } from '../../speech/stt';
import { useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import ResultScreen from '../Result';
import PracticeScreen from '.';
import { fakeRecognition, fakeTts } from './testFakes';

function Probe({ id }: { id: string }) {
  const loc = useLocation();
  return <pre data-testid={id}>{JSON.stringify(loc.state ?? null)}</pre>;
}

const ssd = getPlace('ssd')!;
const orderKo = buildOrderSentence(toOrderLines(ssd.menu!, { tw: 2, bu: 1 }), true)!.ko;

function setup(opts: {
  state?: unknown;
  Recognition?: RecognitionCtor | null;
  lang?: Lang;
  cart?: Record<string, Record<string, number>>;
}) {
  const rec = fakeRecognition();
  const tts = fakeTts();
  const Recognition = 'Recognition' in opts ? opts.Recognition : rec.Ctor;
  useAppStore.setState({
    lang: opts.lang ?? 'en',
    cart: opts.cart ?? { ssd: { tw: 2, bu: 1 } },
    currentPlaceId: 'ssd',
    takeout: true,
    events: [],
  });
  const utils = render(
    <MemoryRouter initialEntries={[{ pathname: PATHS.practice, state: opts.state }]}>
      <Routes>
        <Route
          path={PATHS.practice}
          element={<PracticeScreen Recognition={Recognition} tts={tts} />}
        />
        <Route path={PATHS.result} element={<ResultScreen tts={tts} />} />
        <Route path={PATHS.staff} element={<Probe id="staff" />} />
        <Route path={PATHS.order} element={<Probe id="order" />} />
        <Route path={PATHS.phrases} element={<Probe id="phrases" />} />
      </Routes>
    </MemoryRouter>,
  );
  return { ...utils, rec, tts };
}

const mic = () => document.querySelector<HTMLButtonElement>('.pr-micb')!;
const status = () => screen.getByTestId('practice-status');
const events = () => useAppStore.getState().events;

afterEach(() => {
  vi.useRealTimers();
  useAppStore.setState({ lang: null, cart: {}, currentPlaceId: null, events: [] });
});

describe('S06 입력 상태·문장 표시', () => {
  it("src 'order': 현재 주문 문장 + 장소 문장 목록(1/5), 주문 표시", () => {
    setup({ state: phraseInput('order') });
    expect(screen.getByTestId('screen-practice')).toBeInTheDocument();
    expect(screen.getByText(orderKo)).toBeInTheDocument();
    expect(screen.getByText(/MY ORDER/)).toHaveTextContent('Sungsimdang');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
    expect(screen.getByText('1/5')).toBeInTheDocument();
  });

  it("src 'phrase': 그 문장이 속한 장소 목록에서 위치 표시 (gwc-2 → 2/4)", () => {
    setup({ state: phraseInput('phrase', 'gwc-2') });
    expect(screen.getByText('덜 맵게 해 주세요')).toBeInTheDocument();
    expect(screen.getByText('2/4')).toBeInTheDocument();
    expect(screen.getByText('“Less spicy, please.”')).toBeInTheDocument();
  });

  it('발음 표기는 언어에 따라 (ja → 가타카나)', () => {
    setup({ state: phraseInput('phrase', 'gwc-2'), lang: 'ja' });
    expect(screen.getByText('トル メプケ ヘ ジュセヨ')).toBeInTheDocument();
  });

  it('state 없음·잘못된 ID → 문장 모음, 빈 주문 → 내 주문', () => {
    setup({ state: undefined });
    expect(screen.getByTestId('phrases')).toBeInTheDocument();
  });
  it('데이터에 없는 문장 ID → 문장 모음', () => {
    setup({ state: phraseInput('phrase', 'nope-9') });
    expect(screen.getByTestId('phrases')).toBeInTheDocument();
  });
  it('빈 주문 → 내 주문', () => {
    setup({ state: phraseInput('order'), cart: {} });
    expect(screen.getByTestId('order')).toBeInTheDocument();
  });
});

describe('S06 마이크 켜기 전 음성 처리 안내 (F-08, 3개 언어)', () => {
  it.each([
    ['en', 'This app does not save your voice or what was recognized.'],
    ['ja', 'このアプリは音声も認識結果も保存しません。'],
    ['zh', '本应用不保存你的语音和识别结果。'],
  ] as const)(
    '%s: 마이크를 누르기 전부터 안내가 보이고 마이크 버튼 설명으로 연결',
    (lang, text) => {
      const { rec } = setup({ state: phraseInput('order'), lang });
      const notice = screen.getByText((c) => c.startsWith(text));
      expect(notice).toBeVisible();
      expect(rec.instances).toHaveLength(0); // 아직 인식을 시작하지 않음
      expect(mic()).toHaveAccessibleDescription(notice.closest('p')!.textContent!);
    },
  );
});

describe('S06 듣기·단어 칩 (F-07)', () => {
  it('보통·0.75배속 듣기 → speak(rate), phrase_play를 실제 ID로 기록', () => {
    const { tts } = setup({ state: phraseInput('phrase', 'gwc-2') });
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    expect(tts.speak).toHaveBeenLastCalledWith('덜 맵게 해 주세요', 1, expect.any(Function));
    fireEvent.click(screen.getByRole('button', { name: 'Listen slowly (0.75×)' }));
    expect(tts.speak).toHaveBeenLastCalledWith('덜 맵게 해 주세요', 0.75, expect.any(Function));
    const plays = events().filter((e) => e.type === 'phrase_play');
    expect(plays).toHaveLength(2);
    expect(plays[0]).toMatchObject({ src: 'phrase', placeId: 'gwc', phraseId: 'gwc-2' });
  });

  it('주문 문장 듣기 → phrase_play src order, phraseId 없음', () => {
    setup({ state: phraseInput('order') });
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    const play = events().find((e) => e.type === 'phrase_play')!;
    expect(play).toMatchObject({ src: 'order', placeId: 'ssd' });
    expect(play).not.toHaveProperty('phraseId');
  });

  it('단어 칩 → 그 단어만 읽고, 문장 재생 기록은 남기지 않음', () => {
    const { tts } = setup({ state: phraseInput('phrase', 'gwc-2') });
    fireEvent.click(screen.getByRole('button', { name: '맵게 spicy' }));
    expect(tts.speak).toHaveBeenLastCalledWith('맵게', 1, expect.any(Function));
    expect(events().filter((e) => e.type === 'phrase_play')).toHaveLength(0);
  });
});

describe('S06 단어 칩 이름 = 보이는 글자 (WCAG 2.5.3 Label in Name, T3.2 axe)', () => {
  /** axe label-content-name-mismatch처럼: 기호 제거·공백 정리·소문자 후 포함 여부 */
  const norm = (v: string) =>
    v
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  /** 보이는 텍스트: 텍스트 노드를 순서대로 이어 붙임 (요소 경계에 공백을 끼우지 않음) */
  const visible = (el: Element) => el.textContent ?? '';

  it.each(['en', 'ja', 'zh'] as const)('%s: 모든 칩의 접근성 이름이 보이는 글자를 포함', (lang) => {
    setup({ state: phraseInput('order'), lang });
    const chips = [...document.querySelectorAll('.pr-word')];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      const name = chip.getAttribute('aria-label')!;
      const text = visible(chip);
      expect(norm(name)).toContain(norm(text));
      // 이름은 보이는 글자로 시작 (2.5.3 권장: 이름 앞부분이 보이는 글자)
      expect(norm(name).startsWith(norm(text))).toBe(true);
    }
  });

  it('en 예: "튀김소보로 Fried Soboro" (구분 기호 없음, 보이는 글자와 같음)', () => {
    setup({ state: phraseInput('order') });
    const chip = screen.getByRole('button', { name: '튀김소보로 Fried Soboro' });
    expect(chip.textContent).toBe('튀김소보로 Fried Soboro');
    expect(chip.getAttribute('aria-label')).not.toContain('·');
  });
});

describe('S06 듣기·인식 상호 배제 (R1 M-01)', () => {
  it('듣기 재생 중 마이크 → tts.cancel 1회, 재생 표시 꺼짐', () => {
    const { tts } = setup({ state: phraseInput('order') });
    const listen = screen.getByRole('button', { name: 'Listen' });
    fireEvent.click(listen);
    expect(listen).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(mic());
    expect(tts.cancel).toHaveBeenCalledTimes(1);
    expect(listen).toHaveAttribute('aria-pressed', 'false');
    expect(status()).toHaveAttribute('data-stt', 'requesting');
  });

  it.each(['requesting', 'listening', 'processing'] as const)(
    '%s 중에는 듣기·천천히 듣기·단어 칩이 비활성, 눌러도 speak 없음',
    (st) => {
      const { tts, rec } = setup({ state: phraseInput('phrase', 'gwc-2') });
      fireEvent.click(mic());
      if (st !== 'requesting') act(() => rec.last().emitStart());
      if (st === 'processing') act(() => rec.last().emitSpeechEnd());
      expect(status()).toHaveAttribute('data-stt', st);
      const buttons = [
        screen.getByRole('button', { name: 'Listen' }),
        screen.getByRole('button', { name: 'Listen slowly (0.75×)' }),
        screen.getByRole('button', { name: '맵게 spicy' }),
      ];
      for (const b of buttons) {
        expect(b).toBeDisabled();
        fireEvent.click(b);
      }
      expect(tts.speak).not.toHaveBeenCalled();
    },
  );

  it('실패 → 듣기(다시 활성) → 재시도: 재시도 때 tts.cancel', () => {
    const { tts, rec } = setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    act(() => rec.last().emitError('no-speech'));
    const listen = screen.getByRole('button', { name: 'Listen' });
    expect(listen).toBeEnabled();
    fireEvent.click(listen);
    expect(tts.speak).toHaveBeenCalledTimes(1);
    tts.cancel.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(tts.cancel).toHaveBeenCalledTimes(1);
    expect(listen).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('S06 STT 상태 머신 연결 (F-08)', () => {
  it('마이크 → requesting: 안내 + 취소·직원에게 보여주기 노출, 취소 → 실패(재시도/직원)', () => {
    const { rec } = setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    expect(rec.last().started).toBe(true);
    expect(rec.last().lang).toBe('ko-KR');
    expect(status()).toHaveAttribute('data-stt', 'requesting');
    expect(status()).toHaveTextContent('Allow microphone access to start');
    expect(screen.getByRole('button', { name: /Show to staff/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(status()).toHaveAttribute('data-stt', 'aborted');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Recording was cancelled.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show to staff/ })).toBeInTheDocument();
  });

  it('requesting 중 직원에게 보여주기 → /staff (입력 상태 계약)', () => {
    setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    fireEvent.click(screen.getByRole('button', { name: /Show to staff/ }));
    expect(JSON.parse(screen.getByTestId('staff').textContent!)).toEqual({ src: 'order' });
  });

  it('requesting 15초 넘기면 timeout (14.9초에는 아직 대기)', () => {
    vi.useFakeTimers();
    setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    act(() => vi.advanceTimersByTime(STT_REQUEST_TIMEOUT_MS - 100));
    expect(status()).toHaveAttribute('data-stt', 'requesting');
    act(() => vi.advanceTimersByTime(100));
    expect(status()).toHaveAttribute('data-stt', 'timeout');
    expect(screen.getByRole('alert')).toHaveTextContent('Time ran out');
  });

  it('listening 8초·processing 8초 기한 → timeout', () => {
    vi.useFakeTimers();
    const { rec } = setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    act(() => rec.last().emitStart());
    expect(status()).toHaveAttribute('data-stt', 'listening');
    expect(status()).toHaveTextContent('Listening… say it now');
    expect(mic()).toHaveAccessibleName('Stop recording');
    act(() => vi.advanceTimersByTime(STT_TIMEOUT_MS - 1));
    act(() => rec.last().emitSpeechEnd());
    expect(status()).toHaveAttribute('data-stt', 'processing');
    act(() => vi.advanceTimersByTime(STT_TIMEOUT_MS - 1));
    expect(status()).toHaveAttribute('data-stt', 'processing');
    act(() => vi.advanceTimersByTime(1));
    expect(status()).toHaveAttribute('data-stt', 'timeout');
  });

  it('듣는 중 마이크 다시 누르면 취소(aborted)', () => {
    const { rec } = setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    act(() => rec.last().emitStart());
    fireEvent.click(mic());
    expect(status()).toHaveAttribute('data-stt', 'aborted');
    expect(rec.last().aborted).toBe(true);
  });

  it.each([
    ['not-allowed', 'Microphone access is off'],
    ['no-speech', 'No speech was recognized.'],
    ['network', 'The speech service could not be reached.'],
    ['audio-capture', 'Speech recognition stopped because of an error.'],
  ])('오류 %s → 실패 안내 + 재시도·직원에게 보여주기', (code, text) => {
    const { rec } = setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    act(() => rec.last().emitError(code));
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('재시도 → 새 인식 시작', () => {
    const { rec } = setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    act(() => rec.last().emitError('no-speech'));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(rec.instances).toHaveLength(2);
    expect(status()).toHaveAttribute('data-stt', 'requesting');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('실패 → 직원에게 보여주기 (phrase 입력은 phraseId 유지)', () => {
    const { rec } = setup({ state: phraseInput('phrase', 'gwc-2') });
    fireEvent.click(mic());
    act(() => rec.last().emitEnd()); // requesting에서 끝남 → aborted
    fireEvent.click(screen.getByRole('button', { name: /Show to staff/ }));
    expect(JSON.parse(screen.getByTestId('staff').textContent!)).toEqual({
      src: 'phrase',
      phraseId: 'gwc-2',
    });
  });

  it('미지원(unsupported): 직원에게 보여주기만, 재시도 없음, 마이크 비활성', () => {
    setup({ state: phraseInput('order'), Recognition: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Speech recognition isn’t available');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(mic()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Show to staff/ }));
    expect(screen.getByTestId('staff')).toBeInTheDocument();
  });

  it('인식 성공 → 채점 결과 화면, practice_done(점수) 기록, 원문은 state·기록에 없음', () => {
    const { rec } = setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    act(() => {
      rec.last().emitStart();
      rec.last().emitSpeechEnd();
      rec.last().emitResult('튀김소보로 2개, 판타롱부추빵 1개 주세요. 포장해 주세요.');
    });
    expect(screen.getByTestId('screen-result')).toBeInTheDocument();
    expect(screen.getByTestId('result-score')).toHaveTextContent('100');
    // 결과 칩은 S06 학습 단위 ('두 개' 한 칩, R1 L-01)
    expect(
      screen.getAllByRole('listitem').map((li) => li.querySelector('[lang="ko"]')!.textContent),
    ).toEqual(['튀김소보로', '두 개', '판타롱부추빵', '한 개', '주세요', '포장해', '주세요']);
    const done = events().filter((e) => e.type === 'practice_done');
    expect(done).toEqual([expect.objectContaining({ src: 'order', placeId: 'ssd', score: 100 })]);
    expect(JSON.stringify(useAppStore.getState())).not.toContain('튀김소보로 2개');
    expect(JSON.stringify(events())).not.toMatch(/transcript|heard/);
  });

  it('인식 결과가 정규화 후 비면 0점 대신 재시도 안내 (점수 없는 practice_done)', () => {
    const { rec } = setup({ state: phraseInput('phrase', 'gwc-2') });
    fireEvent.click(mic());
    act(() => rec.last().emitResult('?!'));
    expect(screen.getByTestId('screen-practice')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nothing was recognized, so there is no score.',
    );
    const done = events().filter((e) => e.type === 'practice_done');
    expect(done).toHaveLength(1);
    expect(done[0]).not.toHaveProperty('score');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(status()).toHaveAttribute('data-stt', 'requesting');
  });

  it('화면 이탈(언마운트) → 인식 중단', () => {
    const { rec, unmount } = setup({ state: phraseInput('order') });
    fireEvent.click(mic());
    act(() => rec.last().emitStart());
    unmount();
    expect(rec.last().aborted).toBe(true);
  });
});
