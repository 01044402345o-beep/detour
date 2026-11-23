import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlace } from '../../data';
import { buildOrderSentence, toOrderLines } from '../../domain/orderSentence';
import { useAppStore, type Cart } from '../../store/useAppStore';
import type { Lang } from '../../types';
import { ToastProvider } from '../../ui';
import OrderScreen from './index';

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

function renderOrder() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/order']}>
        <Routes>
          <Route path="/order" element={<OrderScreen />} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

function setOrder(placeId: string | null, cart: Cart = {}, takeout = false, lang: Lang = 'en') {
  useAppStore.setState({
    lang,
    cart,
    currentPlaceId: placeId,
    takeout,
    pendingPlace: null,
    saved: { places: [], phrases: [] },
    reports: [],
    events: [],
  });
}

const expected = (placeId: string, items: Record<string, number>, takeout: boolean) =>
  buildOrderSentence(toOrderLines(getPlace(placeId)!.menu!, items), takeout)!;

const line = (id: string) => screen.getByTestId(`line-${id}`);

beforeEach(() => {
  localStorage.clear();
  setOrder(null);
  vi.clearAllMocks();
});

describe('S05 내 주문 — 빈 주문', () => {
  it('주문이 없으면 빈 안내, 연습·직원 버튼 비활성', () => {
    renderOrder();
    expect(screen.getByTestId('screen-order')).toBeInTheDocument();
    expect(screen.getByTestId('order-empty')).toHaveTextContent('Your order is empty');
    expect(screen.queryByTestId('order-card')).toBeNull();
    expect(screen.getByRole('button', { name: 'Practice saying it' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show to staff' })).toBeDisabled();
  });

  it('장소는 정했지만 담은 게 없어도 비활성', () => {
    setOrder('ssd', { ssd: {} });
    renderOrder();
    expect(screen.getByTestId('order-empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Practice saying it' })).toBeDisabled();
  });
});

describe('주문 카드 (F-06)', () => {
  it('튀김소보로 2·판타롱부추빵 1 → 문장·발음·번역 (domain/orderSentence와 일치)', () => {
    setOrder('ssd', { ssd: { tw: 2, bu: 1 } });
    renderOrder();
    const want = expected('ssd', { tw: 2, bu: 1 }, false);
    expect(want.ko).toBe('튀김소보로 두 개, 판타롱부추빵 한 개 주세요.');
    const card = screen.getByTestId('order-card');
    expect(screen.getByTestId('order-ko')).toHaveTextContent(want.ko);
    expect(card).toHaveTextContent(want.roman);
    expect(card).toHaveTextContent(want.meaning.en);
    expect(screen.getByRole('button', { name: 'Practice saying it' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Show to staff' })).toBeEnabled();
  });

  it('ja는 가타카나 발음·일본어 번역', () => {
    setOrder('ssd', { ssd: { tw: 1 } }, false, 'ja');
    renderOrder();
    const want = expected('ssd', { tw: 1 }, false);
    const card = screen.getByTestId('order-card');
    expect(card).toHaveTextContent(want.kana);
    expect(card).toHaveTextContent(want.meaning.ja);
    expect(card).not.toHaveTextContent(want.roman);
  });

  it('줄 목록: 줄 금액, 합계 예시가', () => {
    setOrder('ssd', { ssd: { tw: 2, bu: 1 } });
    renderOrder();
    expect(line('tw')).toHaveTextContent('₩3,400');
    expect(line('bu')).toHaveTextContent('₩2,000');
    expect(screen.getByTestId('order-total')).toHaveTextContent('Est. ₩5,400');
  });
});

describe('포장/매장 (F-05, effectiveTakeout)', () => {
  it('포장 → 문장 끝 "포장해 주세요.", 매장 → 제거', () => {
    setOrder('ssd', { ssd: { tw: 1 } });
    renderOrder();
    const ko = () => screen.getByTestId('order-ko').textContent;
    expect(ko()).not.toContain('포장해 주세요');
    fireEvent.click(screen.getByRole('radio', { name: 'To go' }));
    expect(useAppStore.getState().takeout).toBe(true);
    expect(ko()).toBe(expected('ssd', { tw: 1 }, true).ko);
    expect(ko()?.endsWith('포장해 주세요.')).toBe(true);
    expect(screen.getByRole('radio', { name: 'To go' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'For here' }));
    expect(ko()).not.toContain('포장해 주세요');
  });

  it('takeout:false 장소(광천식당)는 전환을 숨기고 매장 고정 — store takeout이 true여도 문장에 포장 없음', () => {
    setOrder('gwc', { gwc: { dt: 2 } }, true);
    renderOrder();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByTestId('dine-in-only')).toHaveTextContent('Dine-in only');
    expect(screen.getByTestId('order-ko').textContent).toBe(expected('gwc', { dt: 2 }, false).ko);
    expect(screen.getByTestId('order-ko').textContent).not.toContain('포장');
  });
});

describe('수량 변경 → 문장 즉시 갱신', () => {
  it('+ 로 수량 증가, 1에서 − 는 줄 삭제, 모두 빼면 빈 주문·버튼 비활성', () => {
    setOrder('ssd', { ssd: { tw: 1, bu: 1 } });
    renderOrder();
    fireEvent.click(within(line('tw')).getByRole('button', { name: /^Add one/ }));
    expect(screen.getByTestId('order-ko')).toHaveTextContent(
      expected('ssd', { tw: 2, bu: 1 }, false).ko,
    );
    fireEvent.click(within(line('bu')).getByRole('button', { name: /^Remove one/ }));
    expect(screen.queryByTestId('line-bu')).toBeNull();
    expect(screen.getByTestId('order-ko')).toHaveTextContent('튀김소보로 두 개 주세요.');
    fireEvent.click(within(line('tw')).getByRole('button', { name: /^Remove one/ }));
    fireEvent.click(within(line('tw')).getByRole('button', { name: /^Remove one/ }));
    expect(screen.getByTestId('order-empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show to staff' })).toBeDisabled();
  });

  it('9에서 + → 9 유지, 안내 토스트', () => {
    setOrder('ssd', { ssd: { tw: 9 } });
    renderOrder();
    fireEvent.click(within(line('tw')).getByRole('button', { name: /^Add one/ }));
    expect(useAppStore.getState().cart.ssd.tw).toBe(9);
    expect(screen.getByTestId('toast-region')).toHaveTextContent('Up to 9 per item');
  });
});

describe('가격 미확인 (F-05)', () => {
  it('오징어두루치기 담으면 줄은 "가격 확인 필요", 합계는 "총액 확인 필요"', () => {
    setOrder('gwc', { gwc: { dt: 1, od: 1 } });
    renderOrder();
    expect(line('od')).toHaveTextContent('Price to be confirmed');
    expect(line('dt')).toHaveTextContent('₩8,000');
    expect(screen.getByTestId('order-total')).toHaveTextContent(
      'Total: to be confirmed at the counter',
    );
  });
});

describe('이동·기록', () => {
  it('말하기 연습 → /practice { src: order }', () => {
    setOrder('ssd', { ssd: { tw: 1 } });
    renderOrder();
    fireEvent.click(screen.getByRole('button', { name: 'Practice saying it' }));
    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-path', '/practice');
    expect(JSON.parse(probe.textContent!)).toEqual({ src: 'order' });
  });

  it('직원에게 보여주기 → /staff { src: order }', () => {
    setOrder('ssd', { ssd: { tw: 1 } });
    renderOrder();
    fireEvent.click(screen.getByRole('button', { name: 'Show to staff' }));
    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-path', '/staff');
    expect(JSON.parse(probe.textContent!)).toEqual({ src: 'order' });
  });

  it('듣기·0.75× → 주문 문장 TTS + phrase_play(src order, 장소 ID)', async () => {
    setOrder('ssd', { ssd: { tw: 2 } });
    renderOrder();
    await act(async () => {});
    const ko = expected('ssd', { tw: 2 }, false).ko;
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    expect(fake.tts.speak).toHaveBeenLastCalledWith(ko, 1, expect.any(Function));
    fireEvent.click(screen.getByRole('button', { name: 'Listen slowly (0.75×)' }));
    expect(fake.tts.speak).toHaveBeenLastCalledWith(ko, 0.75, expect.any(Function));
    const plays = useAppStore.getState().events.filter((e) => e.type === 'phrase_play');
    expect(plays).toHaveLength(2);
    expect(plays[0]).toMatchObject({ src: 'order', placeId: 'ssd' });
  });

  it('screen_view는 화면에서 기록하지 않음', () => {
    setOrder('ssd', { ssd: { tw: 1 } });
    renderOrder();
    expect(useAppStore.getState().events).toEqual([]);
  });
});
