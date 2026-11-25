import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { getPlace } from '../../data';
import type { AppEvent } from '../../domain/events';
import { buildOrderSentence, toOrderLines } from '../../domain/orderSentence';
import { STAFF_KO } from '../../i18n/staffKo';
import { PATHS } from '../../router/routes';
import { useAppStore, type Cart } from '../../store/useAppStore';
import type { Lang } from '../../types';
import StaffScreen from '.';
import {
  STAFF_SIZE_LEVELS,
  STAFF_SIZES,
  findPhrase,
  resolveStaffContent,
  STAFF_WIDE_EM,
  staffDisplaySize,
  staffFontSize,
  staffLongestWordEm,
  staffSizeControls,
} from './staffContent';

const tts = vi.hoisted(() => ({
  init: vi.fn(() => Promise.resolve('ready' as const)),
  getState: vi.fn((): 'ready' | null => 'ready'),
  speak: vi.fn<(text: string, rate?: 1 | 0.75, onEnd?: () => void) => 'started'>(() => 'started'),
  cancel: vi.fn(),
  bindAutoCancel: vi.fn(() => () => {}),
}));

vi.mock('../../speech/tts', async (orig) => ({
  ...(await orig<typeof import('../../speech/tts')>()),
  getTts: () => tts,
}));

const ssd = getPlace('ssd')!;
const gwc = getPlace('gwc')!;

function Probe() {
  const loc = useLocation();
  return (
    <div data-testid="probe">
      {loc.pathname}|{JSON.stringify(loc.state ?? null)}
    </div>
  );
}

type Setup = {
  state?: unknown;
  lang?: Lang;
  cart?: Cart;
  currentPlaceId?: string | null;
  takeout?: boolean;
  /** 이전 화면이 있는 상태로 열기 */
  withHistory?: boolean;
};

function renderStaff({
  state,
  lang = 'en',
  cart = { ssd: { tw: 2, bu: 1 } },
  currentPlaceId = 'ssd',
  takeout = false,
  withHistory = false,
}: Setup = {}) {
  useAppStore.setState({ lang, cart, currentPlaceId, takeout, events: [] });
  const entries = [...(withHistory ? [PATHS.order] : []), { pathname: PATHS.staff, state }];
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path={PATHS.staff} element={<StaffScreen />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const events = () => useAppStore.getState().events;
const ofType = <T extends AppEvent['type']>(type: T) =>
  events().filter((e): e is Extract<AppEvent, { type: T }> => e.type === type);
const sentenceEl = () => screen.getByTestId('staff-sentence');

beforeEach(() => {
  vi.clearAllMocks();
  tts.getState.mockReturnValue('ready');
});

afterEach(() => {
  useAppStore.setState({ lang: null, cart: {}, currentPlaceId: null, takeout: false, events: [] });
  localStorage.clear();
});

describe('S08 주문 표시 (src: order)', () => {
  it('주문 문장·한국어 고정 안내(주문)·주문 항목 목록·손님 언어 뜻을 보여줌', () => {
    renderStaff({ state: { src: 'order' } });
    const expected = buildOrderSentence(toOrderLines(ssd.menu!, { tw: 2, bu: 1 }), false)!;
    expect(screen.getByTestId('screen-staff')).toBeInTheDocument();
    expect(screen.getByTestId('staff-note')).toHaveTextContent(STAFF_KO.noteOrder);
    expect(sentenceEl()).toHaveTextContent(expected.ko);
    expect(sentenceEl()).toHaveAttribute('lang', 'ko');
    const lines = within(screen.getByTestId('staff-lines')).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(screen.queryByTestId('staff-takeout')).toBeNull(); // 매장: 포장 줄 없음
    const tw = ssd.menu!.find((m) => m.id === 'tw')!;
    const bu = ssd.menu!.find((m) => m.id === 'bu')!;
    expect(lines[0]).toHaveTextContent(`${tw.ko} 2${tw.counter}`);
    expect(lines[1]).toHaveTextContent(`${bu.ko} 1${bu.counter}`);
    expect(screen.getByText(expected.meaning.en)).toBeInTheDocument();
  });

  it('포장은 effectiveTakeout 기준: 성심당 포장 → 문장에 포장, 광천식당은 무시', () => {
    renderStaff({ takeout: true });
    expect(sentenceEl()).toHaveTextContent('포장해 주세요.');
  });

  it("포장이면 주문 목록 끝에 '· 포장' 줄 (STAFF_KO.takeoutLine)", () => {
    renderStaff({ takeout: true });
    const lines = within(screen.getByTestId('staff-lines')).getAllByRole('listitem');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe(screen.getByTestId('staff-takeout'));
    expect(lines[2]).toHaveTextContent(`· ${STAFF_KO.takeoutLine}`);
  });

  it.each<Lang>(['en', 'ja', 'zh'])("%s: '· 포장' 줄은 언어와 무관하게 한국어 고정", (lang) => {
    renderStaff({ takeout: true, lang });
    expect(screen.getByTestId('staff-takeout')).toHaveTextContent(STAFF_KO.takeoutLine);
  });

  it('광천식당(takeout:false)에서는 takeout 값이 남아 있어도 포장 문장 없음', () => {
    renderStaff({ cart: { gwc: { dt: 2 } }, currentPlaceId: 'gwc', takeout: true });
    const expected = buildOrderSentence(toOrderLines(gwc.menu!, { dt: 2 }), false)!;
    expect(sentenceEl()).toHaveTextContent(expected.ko);
    expect(sentenceEl()).not.toHaveTextContent('포장');
    expect(screen.queryByTestId('staff-takeout')).toBeNull(); // effectiveTakeout false
    const dt = gwc.menu!.find((m) => m.id === 'dt')!;
    expect(screen.getByTestId('staff-lines')).toHaveTextContent(`${dt.ko} 2${dt.counter}`);
  });

  it('staff_shown을 실제 장소 ID로 1회 기록 (다시 렌더해도 1회)', () => {
    renderStaff({ state: { src: 'order' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bigger' }));
    expect(ofType('staff_shown')).toEqual([
      expect.objectContaining({ type: 'staff_shown', src: 'order', placeId: 'ssd' }),
    ]);
    expect(ofType('staff_shown')[0]).not.toHaveProperty('phraseId');
  });
});

describe('S08 일반 문장 표시 (src: phrase)', () => {
  it('문장만 표시, 주문 목록 없음, 안내는 "외국인 손님의 요청입니다"', () => {
    const { phrase } = findPhrase('ssd-3')!;
    renderStaff({ state: { src: 'phrase', phraseId: 'ssd-3' } });
    expect(screen.getByTestId('staff-note')).toHaveTextContent(STAFF_KO.noteRequest);
    expect(screen.getByTestId('staff-note')).not.toHaveTextContent(STAFF_KO.noteOrder);
    expect(sentenceEl()).toHaveTextContent(phrase.ko);
    expect(screen.queryByTestId('staff-lines')).toBeNull();
    expect(screen.getByText(phrase.meaning.en)).toBeInTheDocument();
  });

  it('주문이 비어 있어도 일반 문장은 표시', () => {
    renderStaff({ state: { src: 'phrase', phraseId: 'eun-2' }, cart: {}, currentPlaceId: null });
    expect(sentenceEl()).toHaveTextContent(findPhrase('eun-2')!.phrase.ko);
  });

  it('staff_shown에 문장 ID와 그 문장의 장소 ID를 기록', () => {
    renderStaff({ state: { src: 'phrase', phraseId: 'eun-2' } });
    expect(ofType('staff_shown')).toEqual([
      expect.objectContaining({ src: 'phrase', placeId: 'eun', phraseId: 'eun-2' }),
    ]);
  });
});

describe('S08 입력 상태 검증', () => {
  it('state 없음(직접 진입) → 현재 주문 표시', () => {
    renderStaff({ state: undefined });
    expect(screen.getByTestId('staff-note')).toHaveTextContent(STAFF_KO.noteOrder);
  });

  it('데이터에 없는 문장 ID·잘못된 형식 → 현재 주문으로 대신', () => {
    renderStaff({ state: { src: 'phrase', phraseId: 'nope-9' } });
    expect(screen.getByTestId('staff-lines')).toBeInTheDocument();
  });

  it('주문도 비어 있으면 빈 주문 안내 + 코스로, 응답 버튼·기록 없음', () => {
    renderStaff({ state: { src: 'order' }, cart: {}, currentPlaceId: 'ssd' });
    expect(screen.getByText('Your order is empty')).toBeInTheDocument();
    expect(screen.queryByTestId('staff-sentence')).toBeNull();
    expect(screen.queryByRole('button', { name: /품절이에요/ })).toBeNull();
    expect(ofType('staff_shown')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Course' }));
    expect(screen.getByTestId('probe')).toHaveTextContent(PATHS.course);
  });

  it('resolveStaffContent: 메뉴 없는 장소의 주문은 null', () => {
    expect(
      resolveStaffContent(null, { cart: { eun: { x: 1 } }, currentPlaceId: 'eun', takeout: false }),
    ).toBeNull();
  });
});

describe('S08 글자 크기 A−/A+ (T6.5)', () => {
  it('A+ 는 한 단계씩 키우고 끝 단계에서 비활성, A− 는 반대 (짧은 문장: 64 → 72 → 56)', () => {
    renderStaff({ cart: { ssd: { tw: 1 } } });
    const up = screen.getByRole('button', { name: 'Bigger' });
    const down = screen.getByRole('button', { name: 'Smaller' });
    const ko = sentenceEl().textContent!;
    const size = () => sentenceEl().style.fontSize;
    expect(size()).toBe(`${staffFontSize(ko)}px`);
    fireEvent.click(up);
    expect(size()).toBe(`${staffFontSize(ko, 2)}px`);
    expect(up).toBeDisabled();
    fireEvent.click(down);
    fireEvent.click(down);
    expect(size()).toBe(`${staffFontSize(ko, 0)}px`);
    expect(down).toBeDisabled();
    expect(up).toBeEnabled();
  });

  it('글자 크기 묶음은 이름 있는 group', () => {
    renderStaff();
    const group = screen.getByRole('group', { name: 'Text size' });
    expect(within(group).getAllByRole('button')).toHaveLength(2);
  });

  it('staffFontSize: 모든 단계 56~72px, 짧은 문장 기본 64, 긴 문장 기본 56 (R1 M-01)', () => {
    expect(STAFF_SIZES).toEqual([56, 64, 72]);
    expect(STAFF_SIZE_LEVELS).toBe(3);
    expect(staffFontSize('카드 돼요?')).toBe(64);
    expect(staffFontSize('가'.repeat(20))).toBe(56);
    expect(staffFontSize('가'.repeat(60))).toBe(56);
    for (const ko of ['카드 돼요?', '가'.repeat(20), '가'.repeat(60)]) {
      expect([0, 1, 2].map((l) => staffFontSize(ko, l))).toEqual([56, 64, 72]);
    }
    expect(staffFontSize('가', 9)).toBe(72); // 범위 밖은 끝 단계로
    expect(staffFontSize('가', -3)).toBe(56);
  });

  it('여러 메뉴의 긴 문장: 처음 56px, A−는 비활성, A+로 72px까지', () => {
    renderStaff({ cart: { ssd: { tw: 2, bu: 1, mr: 3, bm: 1 } }, takeout: true });
    const size = () => parseInt(sentenceEl().style.fontSize, 10);
    expect(size()).toBe(56);
    expect(screen.getByRole('button', { name: 'Smaller' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Bigger' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bigger' }));
    expect(size()).toBe(72);
  });
});

describe('S08 큰 문장: 낱말 중간 끊김 방지 (T6.7 M-04)', () => {
  it('staffLongestWordEm: 일반 공백으로만 나눈 가장 긴 낱말 폭(em), 줄바꿈 없는 공백으로 붙인 수량은 한 덩어리', () => {
    expect(staffLongestWordEm('판타롱부추빵 한\u00a0개 주세요.')).toBeCloseTo(6 * STAFF_WIDE_EM);
    expect(staffLongestWordEm('보문산메아리 두\u00a0개, 판타롱부추빵 한\u00a0개')).toBeCloseTo(6 * STAFF_WIDE_EM);
    expect(staffLongestWordEm('가 나')).toBeCloseTo(STAFF_WIDE_EM);
    expect(staffLongestWordEm('')).toBe(0);
  });

  it('staffDisplaySize: 단계 크기를 낱말이 들어가는 크기로 제한, 56px 하한 우선 (R1 M-01)', () => {
    const long = '가'.repeat(20); // 기본 단계 0
    // 360px 폰 줄 폭 328px, 6글자 낱말(5.4em) → 60.7px까지
    expect([0, 1, 2].map((l) => staffDisplaySize(long, l, 5.4, 328))).toEqual([56, 60.7, 60.7]);
    // 7글자 낱말(6.3em, 오징어두루치기) → 52px지만 56px 아래로는 내리지 않음
    expect([0, 1, 2].map((l) => staffDisplaySize(long, l, 6.3, 328))).toEqual([56, 56, 56]);
    // 430px 폰(398px)은 단계 그대로
    expect([0, 1, 2].map((l) => staffDisplaySize(long, l, 5.4, 398))).toEqual([56, 64, 72]);
    // 폭을 모르면 단계 그대로
    expect(staffDisplaySize(long, 2, 6.3, null)).toBe(72);
  });

  it('staffSizeControls: 실제 크기가 바뀌는 단계만 A+/A−로 갈 수 있고, 없으면 null(버튼 비활성)', () => {
    const long = '가'.repeat(20);
    expect(staffSizeControls(long, 0, 6.3, 328)).toEqual({ px: 56, bigger: null, smaller: null });
    expect(staffSizeControls(long, 0, 5.4, 328)).toEqual({ px: 56, bigger: 1, smaller: null });
    expect(staffSizeControls(long, 1, 5.4, 328)).toEqual({ px: 60.7, bigger: null, smaller: 0 });
    // 폭이 줄어 2단계가 1단계와 같아진 경우: A−는 실제로 작아지는 0단계로
    expect(staffSizeControls(long, 2, 5.4, 328)).toEqual({ px: 60.7, bigger: null, smaller: 0 });
    expect(staffSizeControls(long, 1, 5.4, 398)).toEqual({ px: 64, bigger: 2, smaller: 0 });
  });

  describe('줄 폭을 아는 화면 (clientWidth 328px = 360px 폰)', () => {
    let spy: { mockRestore: () => void };
    beforeEach(() => {
      spy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(328);
    });
    afterEach(() => spy.mockRestore());

    it('오징어두루치기(7글자 낱말): 56px 유지, 크기를 바꿀 단계가 없어 A+/A− 모두 비활성', () => {
      renderStaff({ cart: { gwc: { od: 1 } }, currentPlaceId: 'gwc' });
      expect(sentenceEl().textContent).toContain('오징어두루치기');
      expect(sentenceEl().style.fontSize).toBe('56px');
      expect(screen.getByRole('button', { name: 'Bigger' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Smaller' })).toBeDisabled();
    });

    it('성심당 여러 메뉴(6글자 낱말): 56 → A+ 60.7px, 그 위 단계는 같은 크기라 A+ 비활성, A−로 56', () => {
      renderStaff({ cart: { ssd: { tw: 2, bu: 1, mr: 3, bm: 1 } }, takeout: true });
      const up = screen.getByRole('button', { name: 'Bigger' });
      const down = screen.getByRole('button', { name: 'Smaller' });
      expect(sentenceEl().style.fontSize).toBe('56px');
      fireEvent.click(up);
      expect(sentenceEl().style.fontSize).toBe('60.7px');
      expect(up).toBeDisabled();
      expect(down).toBeEnabled();
      fireEvent.click(down);
      expect(sentenceEl().style.fontSize).toBe('56px');
      expect(down).toBeDisabled();
    });
  });
});

describe('S08 T6.5 구성', () => {
  it('한국어 안내에 이모지 없음, 주문이면 예시 합계 표시', () => {
    renderStaff();
    expect(screen.getByTestId('staff-note').textContent).toBe(STAFF_KO.noteOrder);
    // R1 M-03: 직원이 읽는 합계에도 예시 가격 안내(한국어 고정), 숫자만 고정폭
    const total = screen.getByTestId('staff-total');
    expect(total).toHaveTextContent(`${STAFF_KO.sampleTotal} ₩5,400`);
    expect(total).toHaveAttribute('lang', 'ko');
    expect(total.querySelector('.num')).toHaveTextContent(/^₩5,400$/);
  });

  it('가격 미정 메뉴가 섞이면 합계(예시 금액) 줄을 보이지 않음', () => {
    renderStaff({ cart: { gwc: { dt: 1, od: 1 } }, currentPlaceId: 'gwc' });
    expect(screen.queryByTestId('staff-total')).toBeNull();
    expect(screen.queryByText(STAFF_KO.sampleTotal, { exact: false })).toBeNull();
  });

  it('응답 버튼: 네만 파랑 채움, 순서 네·품절·잠시만·계산대', () => {
    renderStaff();
    const replies = screen
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('data-reply'))
      .map((b) => b.getAttribute('data-reply'));
    expect(replies).toEqual(['yes', 'sold', 'wait', 'pay']);
    const yes = screen.getByText(STAFF_KO.replies.yes).closest('button')!;
    expect(yes).toHaveClass('staff__reply--yes');
    expect(screen.getByText(STAFF_KO.replies.sold).closest('button')).not.toHaveClass(
      'staff__reply--yes',
    );
  });

  it('keep-all은 한국어 span에만: 응답 버튼의 번역(small)은 별도 요소 (R1 M-02)', () => {
    renderStaff({ lang: 'ja' });
    for (const k of Object.values(STAFF_KO.replies)) {
      const ko = screen.getByText(k);
      expect(ko).toHaveClass('staff__reply-ko');
      expect(ko.closest('button')!.querySelector('small')).not.toHaveClass('staff__reply-ko');
    }
  });

  it('제목(h1)은 화면 낭독기용으로 남김', () => {
    renderStaff();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Show to staff');
  });
});

describe('S08 읽어주기', () => {
  it('ListenButton으로 한국어 문장을 읽고 phrase_play 기록', () => {
    renderStaff({ state: { src: 'phrase', phraseId: 'ssd-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Play aloud' }));
    expect(tts.speak).toHaveBeenCalledWith(findPhrase('ssd-3')!.phrase.ko, 1, expect.any(Function));
    expect(ofType('phrase_play')).toEqual([
      expect.objectContaining({ src: 'phrase', placeId: 'ssd', phraseId: 'ssd-3' }),
    ]);
  });

  it('주문 문장 읽기 → phrase_play(src order, 장소 ID)', () => {
    renderStaff();
    fireEvent.click(screen.getByRole('button', { name: 'Play aloud' }));
    // 화면은 수·단위 사이를 줄바꿈 없는 공백으로 표시, 읽기는 원문
    expect(tts.speak.mock.calls[0][0]).toBe(sentenceEl().textContent!.replace(/\u00a0/g, ' '));
    expect(sentenceEl().textContent).toContain('\u00a0');
    expect(ofType('phrase_play')).toEqual([
      expect.objectContaining({ src: 'order', placeId: 'ssd' }),
    ]);
  });
});

describe('S08 직원 응답 버튼 (한국어 고정)', () => {
  const ko = Object.values(STAFF_KO.replies);

  it.each<Lang>(['en', 'ja', 'zh'])(
    '%s: 한국어 버튼 4개는 그대로, 아래 작은 글씨만 손님 언어',
    (lang) => {
      renderStaff({ lang });
      for (const k of ko) expect(screen.getByText(k)).toHaveAttribute('lang', 'ko');
      expect(screen.getByText(STAFF_KO.replyPrompt)).toBeInTheDocument();
    },
  );

  it('작은 글씨는 이모지 없는 손님 언어 제목', () => {
    renderStaff({ lang: 'en' });
    const yes = screen.getByText(STAFF_KO.replies.yes).closest('button')!;
    expect(yes).toHaveTextContent('Yes!');
    expect(yes.textContent).not.toContain('👍');
  });

  it.each([
    ['yes', STAFF_KO.replies.yes],
    ['sold', STAFF_KO.replies.sold],
    ['wait', STAFF_KO.replies.wait],
    ['pay', STAFF_KO.replies.pay],
  ] as const)('%s → /reply로 응답과 입력 상태를 넘김', (reply, label) => {
    renderStaff({ state: { src: 'phrase', phraseId: 'ssd-3' } });
    fireEvent.click(screen.getByText(label).closest('button')!);
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `${PATHS.reply}|${JSON.stringify({ reply, input: { src: 'phrase', phraseId: 'ssd-3' } })}`,
    );
  });

  it('직접 진입(state 없음)에서 응답 → input은 order', () => {
    renderStaff();
    fireEvent.click(screen.getByText(STAFF_KO.replies.sold).closest('button')!);
    expect(screen.getByTestId('probe')).toHaveTextContent(
      JSON.stringify({ reply: 'sold', input: { src: 'order' } }),
    );
  });
});

describe('S08 닫기', () => {
  it('이전 화면이 없으면 주문(order) / 문장 모음(phrase)으로', () => {
    renderStaff({ state: { src: 'order' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('probe')).toHaveTextContent(PATHS.order);
  });

  it('phrase 입력이면 문장 모음으로', () => {
    renderStaff({ state: { src: 'phrase', phraseId: 'ssd-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('probe')).toHaveTextContent(PATHS.phrases);
  });
});

describe('S08 화면 켜짐 유지 (Wake Lock)', () => {
  type Sentinel = { released: boolean; release: ReturnType<typeof vi.fn> };
  let sentinels: Sentinel[];
  let request: ReturnType<typeof vi.fn>;

  function installWakeLock(impl?: () => Promise<Sentinel>) {
    sentinels = [];
    request = vi.fn(
      impl ??
        (() => {
          const s: Sentinel = {
            released: false,
            release: vi.fn(() => {
              s.released = true;
              return Promise.resolve();
            }),
          };
          sentinels.push(s);
          return Promise.resolve(s);
        }),
    );
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });
  }

  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
  });

  it("마운트 시 request('screen'), 언마운트 시 release", async () => {
    installWakeLock();
    const r = renderStaff();
    await act(async () => {});
    expect(request).toHaveBeenCalledWith('screen');
    expect(sentinels).toHaveLength(1);
    r.unmount();
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it('탭이 가려졌다 다시 보이면 새로 요청', async () => {
    installWakeLock();
    renderStaff();
    await act(async () => {});
    sentinels[0].released = true; // 브라우저가 가려질 때 해제
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('미지원(navigator.wakeLock 없음)이면 조용히 무시', () => {
    expect(() => renderStaff()).not.toThrow();
    expect(sentenceEl()).toBeInTheDocument();
  });

  it('요청 거부(reject)·동기 오류도 무시', async () => {
    installWakeLock(() => Promise.reject(new Error('NotAllowedError')));
    renderStaff();
    await act(async () => {});
    expect(sentenceEl()).toBeInTheDocument();
    installWakeLock(() => {
      throw new Error('boom');
    });
    expect(() => renderStaff()).not.toThrow();
  });

  it('빈 주문 화면에서는 요청하지 않음', () => {
    installWakeLock();
    renderStaff({ cart: {} });
    expect(request).not.toHaveBeenCalled();
  });
});
