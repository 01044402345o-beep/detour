import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlace } from '../../data';
import { STORAGE_KEY, useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import { ToastProvider } from '../../ui';
import { googlePlaceUrl, naverWalkUrl } from '../../ui/map/externalMap';
import PlaceScreen from './index';

const fake = vi.hoisted(() => ({
  tts: {
    init: vi.fn(async () => 'ready' as const),
    getState: vi.fn(() => 'ready' as const),
    speak: vi.fn<(text: string, rate?: number, onEnd?: () => void) => 'started'>(() => 'started'),
    cancel: vi.fn(),
    bindAutoCancel: vi.fn(() => () => {}),
  },
}));

vi.mock('../../speech/tts', async (orig) => {
  const mod = await orig<typeof import('../../speech/tts')>();
  return { ...mod, getTts: () => fake.tts };
});

function Probe() {
  const loc = useLocation();
  return (
    <div data-testid="probe" data-path={loc.pathname}>
      {JSON.stringify(loc.state ?? null)}
    </div>
  );
}

function renderAt(path: string, state?: unknown) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Routes>
          <Route path="/place/:id" element={<PlaceScreen />} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

function resetStore(lang: Lang = 'en') {
  useAppStore.setState({
    lang,
    cart: {},
    currentPlaceId: null,
    takeout: false,
    pendingPlace: null,
    saved: { places: [], phrases: [] },
    reports: [],
    events: [],
  });
}

const menuCard = (id: string) => screen.getByTestId(`menu-${id}`);
const addIn = (id: string) =>
  fireEvent.click(within(menuCard(id)).getAllByRole('button', { name: /^Add one/ })[0]);
const removeIn = (id: string) =>
  fireEvent.click(within(menuCard(id)).getByRole('button', { name: /^Remove one/ }));

beforeEach(() => {
  localStorage.clear();
  resetStore();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('S03·S04 장소 상세 — 탭', () => {
  it('주문 가능한 장소는 메뉴/주문 방법/문장 탭, 메뉴 탭으로 엶', () => {
    renderAt('/place/ssd');
    expect(screen.getByTestId('screen-place')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Menu', 'How to order', 'Phrases']);
    expect(screen.getByRole('tab', { name: 'Menu' })).toHaveAttribute('aria-selected', 'true');
    expect(menuCard('tw')).toBeInTheDocument();
  });

  it('orderable:false 장소는 메뉴 탭 없이 이용 방법 탭으로 엶', () => {
    renderAt('/place/eun');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['How to visit', 'Phrases']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('menu-tw')).toBeNull();
    // 단계 안내
    expect(screen.getAllByRole('listitem')).toHaveLength(getPlace('eun')!.steps.length);
  });

  it('탭 전환: 문장 탭에서 장소 문장 목록', () => {
    renderAt('/place/ssd');
    fireEvent.click(screen.getByRole('tab', { name: 'Phrases' }));
    for (const ph of getPlace('ssd')!.phrases) {
      expect(screen.getByTestId(`phrase-${ph.id}`)).toHaveTextContent(ph.ko);
    }
  });

  it('location.state.tab으로 탭 지정 (S09 품절 → 주문 수정은 메뉴 탭)', () => {
    renderAt('/place/ssd', { tab: 'phrases' });
    expect(screen.getByRole('tab', { name: 'Phrases' })).toHaveAttribute('aria-selected', 'true');
  });

  it('state.tab이 이 장소에 없는 탭(eun의 menu)이거나 잘못된 값이면 기본 탭', () => {
    const { unmount } = renderAt('/place/eun', { tab: 'menu' });
    expect(screen.getByRole('tab', { name: 'How to visit' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    unmount();
    renderAt('/place/ssd', { tab: 42 });
    expect(screen.getByRole('tab', { name: 'Menu' })).toHaveAttribute('aria-selected', 'true');
  });

  it('없는 장소 ID는 코스로 이동', () => {
    renderAt('/place/nope');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-path', '/course');
  });
});

describe('확인 배지·영업 상태·알레르기·비제휴 안내', () => {
  it('verified:false 장소는 확인일 대신 "현장 확인 전 · 예시 정보"', () => {
    renderAt('/place/ssd');
    const badge = screen.getByTestId('verified-badge');
    expect(badge).toHaveTextContent('Not yet verified on site · sample info');
    expect(badge).not.toHaveTextContent('Checked');
  });

  it('메뉴가 없는 장소도 같은 규칙', () => {
    renderAt('/place/mus');
    expect(screen.getByTestId('verified-badge')).toHaveTextContent('Not yet verified');
  });

  it('verified:true 장소는 확인일 표시 (메뉴 verified와 무관)', () => {
    const p = getPlace('ssd')!;
    p.verified = true;
    try {
      renderAt('/place/ssd');
      expect(screen.getByTestId('verified-badge')).toHaveTextContent(`Checked ${p.checkedAt}`);
    } finally {
      p.verified = false;
    }
  });

  it('영업 상태는 Asia/Seoul 시간표 기준 (서울 10:00 → 영업 중, 23:00 → 영업 종료)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T01:00:00Z')); // 서울 10:00 화요일
    const { unmount } = renderAt('/place/ssd');
    expect(screen.getByTestId('open-status')).toHaveTextContent('Open now');
    unmount();
    vi.setSystemTime(new Date('2026-11-24T14:00:00Z')); // 서울 23:00
    renderAt('/place/ssd');
    expect(screen.getByTestId('open-status')).toHaveTextContent('Closed now');
  });

  it('휴무일(월) 전시관은 영업 종료 + 휴무 요일 표시', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T03:00:00Z')); // 서울 월요일 12:00
    renderAt('/place/mus');
    expect(screen.getByTestId('open-status')).toHaveTextContent('Closed now');
    expect(screen.getByText('Closed: Mon')).toBeInTheDocument();
    expect(screen.getByText(/Based on the listed hours \(Korea time\)/)).toBeInTheDocument();
  });

  it('알레르기 미확인은 "확인 필요"', () => {
    renderAt('/place/ssd');
    expect(screen.getByTestId('allergy')).toHaveTextContent('Allergens: to be confirmed');
  });

  it('비제휴 안내 문구 표시', () => {
    renderAt('/place/gwc');
    expect(screen.getByText(/not affiliated with this store/)).toBeInTheDocument();
  });
});

describe('길찾기 (F-04)', () => {
  it('네이버 지도 웹 길찾기(기본) + Google Maps 장소 보기(보조), 새 창', () => {
    renderAt('/place/ssd');
    fireEvent.click(screen.getByRole('tab', { name: 'How to order' }));
    const p = getPlace('ssd')!;
    const naver = screen.getByTestId('dir-naver');
    expect(naver).toHaveAttribute('href', naverWalkUrl(p));
    expect(naver).toHaveTextContent('Directions');
    expect(naver).toHaveAttribute('target', '_blank');
    expect(naver).toHaveAttribute('rel', 'noopener noreferrer');
    const google = screen.getByTestId('dir-google');
    expect(google).toHaveAttribute('href', googlePlaceUrl(p));
    expect(google).toHaveTextContent('View in Google Maps');
    expect(screen.getByTestId('dir-hint')).toHaveTextContent(
      'Directions open in the NAVER Map app. No app? Use the course map and walk times.',
    );
  });
});

describe('장소 북마크 (F-13)', () => {
  it('추가·해제 + 토스트 + 저장소에 남음(새로고침 후 유지)', () => {
    renderAt('/place/ssd');
    const btn = screen.getByRole('button', { name: 'Save this place' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(useAppStore.getState().saved.places).toEqual(['ssd']);
    expect(screen.getByRole('button', { name: 'Remove from saved' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('toast-region')).toHaveTextContent('Saved');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.state.saved.places).toEqual(['ssd']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove from saved' }));
    expect(useAppStore.getState().saved.places).toEqual([]);
    expect(screen.getByTestId('toast-region')).toHaveTextContent('Removed');
  });

  it('저장된 상태로 다시 열면 해제 버튼으로 표시', () => {
    useAppStore.setState({ saved: { places: ['gwc'], phrases: [] } });
    renderAt('/place/gwc');
    expect(screen.getByRole('button', { name: 'Remove from saved' })).toBeInTheDocument();
  });
});

describe('정보가 달라요 (F-14, ui/ReportSheet)', () => {
  it('깃발 → 제보 시트 → 종류 선택 시 이 장소로 제보 저장', () => {
    renderAt('/place/gwc');
    fireEvent.click(screen.getByRole('button', { name: 'Info looks wrong?' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Price changed/ }));
    const { reports } = useAppStore.getState();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ kind: 'price', placeId: 'gwc' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('메뉴 담기 (F-05)', () => {
  it('+ → 수량 1, 주문 바(수량·합계 예시가) 표시, 다시 + → 2', () => {
    renderAt('/place/ssd');
    expect(screen.queryByTestId('orderbar')).toBeNull();
    addIn('tw');
    expect(useAppStore.getState().currentPlaceId).toBe('ssd');
    expect(within(menuCard('tw')).getByText('1')).toBeInTheDocument();
    const bar = screen.getByTestId('orderbar');
    expect(bar).toHaveTextContent('View my order');
    expect(bar).toHaveTextContent('Est. ₩1,700');
    addIn('tw');
    addIn('bu');
    expect(useAppStore.getState().cart.ssd).toEqual({ tw: 2, bu: 1 });
    expect(screen.getByTestId('orderbar')).toHaveTextContent('3');
    expect(screen.getByTestId('orderbar')).toHaveTextContent('Est. ₩5,400');
  });

  it('1에서 − → 항목 삭제, 주문이 비면 주문 바 대신 연습 버튼', () => {
    renderAt('/place/ssd');
    addIn('tw');
    removeIn('tw');
    expect(useAppStore.getState().cart.ssd).toEqual({});
    expect(within(menuCard('tw')).queryByRole('button', { name: /^Remove one/ })).toBeNull();
    expect(screen.queryByTestId('orderbar')).toBeNull();
    // T6.4: 떠 있는 연습 버튼은 없앰 (연습은 Phrases 탭 안에서)
    expect(screen.queryByRole('button', { name: /Practice/ })).toBeNull();
  });

  it('수량 9에서 + → 9 유지, 안내 토스트', () => {
    useAppStore.setState({ currentPlaceId: 'ssd', cart: { ssd: { tw: 9 } } });
    renderAt('/place/ssd');
    addIn('tw');
    expect(useAppStore.getState().cart.ssd.tw).toBe(9);
    expect(screen.getByTestId('toast-region')).toHaveTextContent('Up to 9 per item');
  });

  it('가격 미확인 메뉴는 중립 회색 "직원에게 확인", 담으면 주문 바에 "총액 확인 필요"', () => {
    renderAt('/place/ssd');
    expect(menuCard('bm')).toHaveTextContent('Price: ask staff');
    expect(within(menuCard('bm')).getByTestId('price-ask')).toHaveClass('mrow__ask');
    addIn('tw');
    addIn('bm');
    const bar = screen.getByTestId('orderbar');
    expect(bar).toHaveTextContent('Total: to be confirmed at the counter');
    expect(bar).not.toHaveTextContent('₩');
  });

  it('인분 메뉴는 1인분 가격 표기', () => {
    renderAt('/place/gwc');
    expect(menuCard('dt')).toHaveTextContent('₩8,000 per person');
  });

  it('주문 바 → 내 주문', () => {
    renderAt('/place/ssd');
    addIn('tw');
    fireEvent.click(screen.getByTestId('orderbar'));
    expect(screen.getByTestId('probe')).toHaveAttribute('data-path', '/order');
  });

  it('주문 바의 수량·합계는 다른 장소 주문을 섞지 않음', () => {
    useAppStore.setState({ currentPlaceId: 'gwc', cart: { gwc: { dt: 2 } } });
    renderAt('/place/ssd');
    expect(screen.queryByTestId('orderbar')).toBeNull();
    expect(within(menuCard('tw')).queryByRole('button', { name: /^Remove one/ })).toBeNull();
  });
});

describe('다른 장소에서 담기 → 기존 주문 비울지 확인 시트', () => {
  beforeEach(() => {
    useAppStore.setState({ currentPlaceId: 'gwc', cart: { gwc: { dt: 2 } } });
  });

  it('확인 시트에 기존 장소 이름, "유지"는 기존 주문 그대로', () => {
    renderAt('/place/ssd');
    addIn('tw');
    const dialog = screen.getByRole('dialog', { name: 'Start a new order here?' });
    expect(dialog).toHaveTextContent('Your order at Gwangcheon Sikdang will be cleared.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep my order' }));
    const s = useAppStore.getState();
    expect(s.currentPlaceId).toBe('gwc');
    expect(s.cart).toEqual({ gwc: { dt: 2 } });
    expect(s.pendingPlace).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"비우고 계속" → 기존 주문 비우고 새 장소에 1개 담음', () => {
    renderAt('/place/ssd');
    addIn('tw');
    fireEvent.click(screen.getByRole('button', { name: 'Clear and continue' }));
    const s = useAppStore.getState();
    expect(s.currentPlaceId).toBe('ssd');
    expect(s.cart).toEqual({ ssd: { tw: 1 } });
    expect(screen.getByTestId('orderbar')).toHaveTextContent('Est. ₩1,700');
  });

  it('Esc(바탕 닫기)도 유지와 같음', () => {
    renderAt('/place/ssd');
    addIn('tw');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().currentPlaceId).toBe('gwc');
    expect(useAppStore.getState().pendingPlace).toBeNull();
  });
});

describe('이용 기록', () => {
  it('place_view를 실제 장소 ID로 1회 기록 (screen_view는 기록하지 않음)', () => {
    renderAt('/place/gwc');
    const events = useAppStore.getState().events;
    expect(events.filter((e) => e.type === 'place_view')).toEqual([
      expect.objectContaining({ type: 'place_view', placeId: 'gwc' }),
    ]);
    expect(events.some((e) => e.type === 'screen_view')).toBe(false);
  });

  it('문장 듣기 → TTS + phrase_play(src phrase, 장소·문장 ID)', async () => {
    renderAt('/place/ssd');
    fireEvent.click(screen.getByRole('tab', { name: 'Phrases' }));
    const ph = getPlace('ssd')!.phrases[1];
    await act(async () => {});
    fireEvent.click(
      within(screen.getByTestId(`phrase-${ph.id}`)).getByRole('button', { name: 'Listen' }),
    );
    expect(fake.tts.speak).toHaveBeenCalledWith(ph.ko, 1, expect.any(Function));
    expect(useAppStore.getState().events.at(-1)).toMatchObject({
      type: 'phrase_play',
      src: 'phrase',
      placeId: 'ssd',
      phraseId: ph.id,
    });
  });

  it('문장 누르기 → 연습 화면에 { src: phrase, phraseId }', () => {
    renderAt('/place/eun');
    fireEvent.click(screen.getByRole('tab', { name: 'Phrases' }));
    const ph = getPlace('eun')!.phrases[0];
    fireEvent.click(within(screen.getByTestId(`phrase-${ph.id}`)).getAllByRole('button')[0]);
    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-path', '/practice');
    expect(JSON.parse(probe.textContent!)).toEqual({ src: 'phrase', phraseId: ph.id });
  });

  it('떠 있는 연습 버튼 없음 (T6.4) — 문장 탭 첫 문장 → 이 장소 첫 문장으로 연습', () => {
    renderAt('/place/mus');
    expect(screen.queryByRole('button', { name: /Practice/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Phrases' }));
    fireEvent.click(within(screen.getByTestId('phrase-mus-1')).getAllByRole('button')[0]);
    expect(JSON.parse(screen.getByTestId('probe').textContent!)).toEqual({
      src: 'phrase',
      phraseId: 'mus-1',
    });
  });
});

/** 같은 /place/:id로 새 history entry를 만드는 버튼 (S09 '주문 수정'과 같은 이동) */
function SamePlaceNav({ to, state }: { to: string; state: unknown }) {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="nav-same" onClick={() => navigate(to, { state })}>
      go
    </button>
  );
}

function renderWithNav(path: string, state: unknown) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <SamePlaceNav to={path} state={state} />
        <Routes>
          <Route path="/place/:id" element={<PlaceScreen />} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('영업 상태 참고값 안내 (R1 M-02)', () => {
  it.each(['Menu', 'How to order', 'Phrases'])('%s 탭에서도 상태 옆에 안내가 보임', (tabName) => {
    renderAt('/place/ssd');
    fireEvent.click(screen.getByRole('tab', { name: tabName }));
    const note = screen.getByTestId('status-note');
    expect(note).toHaveTextContent('Based on the listed hours (Korea time). For reference only.');
    expect(screen.getByTestId('open-status')).toHaveAttribute('aria-describedby', note.id);
    // 같은 안내가 두 번 나오지 않음
    expect(screen.getAllByText(/Based on the listed hours/)).toHaveLength(1);
  });

  it('시간표를 읽을 수 없어 상태가 없으면 안내도 숨김', () => {
    const p = getPlace('ssd')!;
    const hours = p.hours;
    p.hours = 'n/a';
    try {
      renderAt('/place/ssd');
      expect(screen.queryByTestId('open-status')).toBeNull();
      expect(screen.queryByTestId('status-note')).toBeNull();
    } finally {
      p.hours = hours;
    }
  });
});

describe('같은 장소 재이동 시 state.tab 반영 (R1 L-01)', () => {
  it('이용 방법 탭에서 같은 경로로 { tab: menu } 이동 → 메뉴 탭', () => {
    renderWithNav('/place/ssd', { tab: 'menu' });
    fireEvent.click(screen.getByRole('tab', { name: 'How to order' }));
    expect(screen.getByRole('tab', { name: 'How to order' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByTestId('nav-same'));
    expect(screen.getByRole('tab', { name: 'Menu' })).toHaveAttribute('aria-selected', 'true');
  });

  it('탭을 직접 누르는 것은 이동이 아니므로 초기화되지 않음, 새 진입은 place_view를 다시 기록', () => {
    renderWithNav('/place/ssd', { tab: 'phrases' });
    fireEvent.click(screen.getByRole('tab', { name: 'How to order' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Phrases' }));
    fireEvent.click(screen.getByRole('tab', { name: 'How to order' }));
    expect(screen.getByRole('tab', { name: 'How to order' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(useAppStore.getState().events.filter((e) => e.type === 'place_view')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('nav-same'));
    expect(screen.getByRole('tab', { name: 'Phrases' })).toHaveAttribute('aria-selected', 'true');
    expect(useAppStore.getState().events.filter((e) => e.type === 'place_view')).toHaveLength(2);
  });
});

describe('언어 전환', () => {
  it('ja: 장소 이름·탭·발음(가타카나) 일본어', () => {
    resetStore('ja');
    renderAt('/place/ssd');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('聖心堂 本店');
    fireEvent.click(screen.getAllByRole('tab')[2]);
    const ph = getPlace('ssd')!.phrases[0];
    expect(screen.getByTestId(`phrase-${ph.id}`)).toHaveTextContent(ph.kana);
  });
});

describe('T6.4 머리·진행 표시·닫힘·주문 바', () => {
  it('사진이 있는 장소(ssd): 사진 머리(eager) + 짧은 출처 + 큰 한글 이름', () => {
    renderAt('/place/ssd');
    const hero = screen.getByTestId('place-hero');
    expect(hero).toHaveClass('place-hero--photo');
    const img = within(hero).getByRole('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img.getAttribute('src')).toMatch(/photos\/.+\.webp$/);
    expect(img).toHaveAccessibleName(/Sungsimdang/);
    expect(screen.getByTestId('photo-credit')).toHaveTextContent(
      'Photo: Trainholic · CC BY-SA 4.0',
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(within(h1).getByText('성심당 본점')).toHaveAttribute('lang', 'ko');
    expect(h1).toHaveTextContent('Sungsimdang Main Store');
  });

  it.each(['gwc', 'sy'])('사진이 없는 장소(%s): 파란 글자 머리, 사진·출처 없음', (id) => {
    renderAt(`/place/${id}`);
    const hero = screen.getByTestId('place-hero');
    expect(hero).toHaveClass('place-hero--text');
    expect(within(hero).queryByRole('img')).toBeNull();
    expect(screen.queryByTestId('photo-credit')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getPlace(id)!.nameKo);
  });

  it('진행 표시: Stop n of N + 다음 정류장, 마지막 정류장', () => {
    const { unmount } = renderAt('/place/ssd');
    const prog = screen.getByTestId('place-progress');
    expect(prog).toHaveTextContent('Stop 1 of 4');
    expect(prog).toHaveTextContent('Next: Euneungjeongi Culture Street, 2 min walk');
    expect(prog.querySelectorAll('.place-prog__dot')).toHaveLength(4);
    expect(prog.querySelector('.place-prog__dot.is-cur')).toBe(
      prog.querySelectorAll('.place-prog__dot')[0],
    );
    unmount();
    renderAt('/place/gwc');
    expect(screen.getByTestId('place-progress')).toHaveTextContent('Stop 4 of 4 · Last stop');
  });

  it('지금 닫힘: 중립색 표시 + 다음 영업 시각 (영업 중이면 시간표)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T14:00:00Z')); // 서울 화 23:00
    const { unmount } = renderAt('/place/ssd');
    expect(screen.getByTestId('open-status')).toHaveClass('is-closed');
    expect(screen.getByTestId('next-open')).toHaveTextContent('Opens tomorrow at 08:00');
    unmount();
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z')); // 서울 일 19:00, 월 휴무
    const r2 = renderAt('/place/mus');
    expect(screen.getByTestId('next-open')).toHaveTextContent('Opens Tue at 10:00');
    r2.unmount();
    vi.setSystemTime(new Date('2026-11-24T01:00:00Z')); // 서울 화 10:00
    renderAt('/place/ssd');
    expect(screen.getByTestId('open-status')).toHaveClass('is-open');
    expect(screen.queryByTestId('next-open')).toBeNull();
    expect(screen.getByText('08:00–22:00')).toBeInTheDocument();
  });

  it('지금 닫힘 다음 영업 시각: ja·zh 문구', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T22:00:00Z')); // 서울 화 07:00
    resetStore('ja');
    const { unmount } = renderAt('/place/ssd');
    expect(screen.getByTestId('next-open')).toHaveTextContent('08:00から営業');
    unmount();
    resetStore('zh');
    renderAt('/place/ssd');
    expect(screen.getByTestId('next-open')).toHaveTextContent('08:00 开始营业');
  });

  it('주문 바는 담은 메뉴가 있을 때만, 담은 줄은 선택 표시', () => {
    renderAt('/place/ssd');
    expect(screen.queryByTestId('orderbar')).toBeNull();
    expect(menuCard('tw')).not.toHaveClass('is-sel');
    addIn('tw');
    expect(menuCard('tw')).toHaveClass('is-sel');
    expect(screen.getByTestId('orderbar')).toBeInTheDocument();
  });

  it('비주문 장소(eun)는 메뉴 탭·주문 바 없음', () => {
    renderAt('/place/eun');
    expect(screen.queryByRole('tab', { name: 'Menu' })).toBeNull();
    expect(screen.queryByTestId('orderbar')).toBeNull();
  });
});

describe('T6.4 R1 L-01 숫자 글꼴', () => {
  it('다음 영업 시각·주문 합계는 치환값만 .num, 문장은 일반 글꼴', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T14:00:00Z')); // 서울 화 23:00
    renderAt('/place/ssd');
    const next = screen.getByTestId('next-open');
    expect(next).toHaveTextContent('Opens tomorrow at 08:00');
    expect(next).not.toHaveClass('num');
    expect(within(next).getByText('08:00')).toHaveClass('num');
    addIn('tw');
    const bar = screen.getByTestId('orderbar');
    expect(bar).toHaveTextContent('Est. ₩1,700');
    expect(within(bar).getByText('₩1,700')).toHaveClass('num');
  });
});
