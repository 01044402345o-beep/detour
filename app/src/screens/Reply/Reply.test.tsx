import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { DICTS } from '../../i18n';
import { STAFF_KO, STAFF_REPLY_KEYS, type StaffReply } from '../../i18n/staffKo';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import ReplyScreen from '.';
import { REPLY_ORDER, parseReplyInput, replyInput } from './replyState';

function Probe() {
  const loc = useLocation();
  return (
    <div data-testid="probe">
      {loc.pathname}|{JSON.stringify(loc.state ?? null)}
    </div>
  );
}

function renderReply(state: unknown, lang: Lang = 'en', currentPlaceId: string | null = 'ssd') {
  useAppStore.setState({
    lang,
    currentPlaceId,
    cart: currentPlaceId ? { [currentPlaceId]: { tw: 1 } } : {},
  });
  return render(
    <MemoryRouter initialEntries={[{ pathname: PATHS.reply, state }]}>
      <Routes>
        <Route path={PATHS.reply} element={<ReplyScreen />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const dictValue = (lang: Lang, key: string) =>
  key.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], DICTS[lang]);

afterEach(() => {
  useAppStore.setState({ lang: null, cart: {}, currentPlaceId: null });
  localStorage.clear();
});

describe('S09 응답 4종 → 손님 언어로 크게', () => {
  for (const lang of ['en', 'ja', 'zh'] as const) {
    it.each(REPLY_ORDER)(`${lang}: %s`, (reply) => {
      renderReply(replyInput(reply, { src: 'order' }), lang);
      expect(screen.getByTestId('screen-reply')).toHaveClass(`reply--${reply}`);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        dictValue(lang, STAFF_REPLY_KEYS[reply].title) as string,
      );
      expect(
        screen.getByText(dictValue(lang, STAFF_REPLY_KEYS[reply].body) as string),
      ).toBeInTheDocument();
      // 한국어 응답은 언어와 무관하게 고정
      const ko = screen.getByTestId('reply-ko');
      expect(ko).toHaveTextContent(`${STAFF_KO.replyResultPrefix} · ${STAFF_KO.replies[reply]}`);
      expect(ko).toHaveAttribute('lang', 'ko');
    });
  }
});

describe('S09 품절 → 주문 수정', () => {
  it('품절이면 "주문 수정" → 현재 주문 장소의 메뉴 탭', () => {
    renderReply(replyInput('sold', { src: 'order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change my order' }));
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `/place/ssd|${JSON.stringify({ tab: 'menu' })}`,
    );
  });

  it.each<StaffReply>(['yes', 'wait', 'pay'])('%s에는 주문 수정 없음', (reply) => {
    renderReply(replyInput(reply, { src: 'order' }));
    expect(screen.queryByRole('button', { name: 'Change my order' })).toBeNull();
  });

  it('일반 문장(주문 가능한 장소의 문장) 품절 → 그 장소 메뉴 탭', () => {
    renderReply(replyInput('sold', { src: 'phrase', phraseId: 'gwc-3' }), 'en', null);
    fireEvent.click(screen.getByRole('button', { name: 'Change my order' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('/place/gwc|');
  });

  it('메뉴가 없는 장소의 문장이거나 현재 주문 장소가 없으면 주문 수정 숨김', () => {
    renderReply(replyInput('sold', { src: 'phrase', phraseId: 'eun-2' }));
    expect(screen.queryByRole('button', { name: 'Change my order' })).toBeNull();
  });

  it('현재 주문 장소가 없으면(order) 주문 수정 숨김', () => {
    renderReply(replyInput('sold', { src: 'order' }), 'en', null);
    expect(screen.queryByRole('button', { name: 'Change my order' })).toBeNull();
  });
});

describe('S09 이동', () => {
  it('"직원에게 다시 보여주기" → 같은 입력으로 직원 화면', () => {
    renderReply(replyInput('wait', { src: 'phrase', phraseId: 'ssd-3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show to staff again' }));
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `${PATHS.staff}|${JSON.stringify({ src: 'phrase', phraseId: 'ssd-3' })}`,
    );
  });

  it('완료 → 코스', () => {
    renderReply(replyInput('yes', { src: 'order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('probe')).toHaveTextContent(`${PATHS.course}|`);
  });

  it('응답 state가 없거나 틀리면 직원 화면으로', () => {
    renderReply(undefined);
    expect(screen.getByTestId('probe')).toHaveTextContent(PATHS.staff);
  });
});

describe('parseReplyInput', () => {
  it('정상 값', () => {
    expect(parseReplyInput({ reply: 'sold', input: { src: 'phrase', phraseId: 'ssd-1' } })).toEqual(
      { reply: 'sold', input: { src: 'phrase', phraseId: 'ssd-1' } },
    );
  });
  it('응답 종류가 틀리면 null', () => {
    expect(parseReplyInput(null)).toBeNull();
    expect(parseReplyInput('sold')).toBeNull();
    expect(parseReplyInput({ reply: 'maybe', input: { src: 'order' } })).toBeNull();
  });
  it('함께 온 입력이 틀리면 order로 대신', () => {
    expect(parseReplyInput({ reply: 'yes', input: { src: 'phrase', phraseId: 'BAD ID' } })).toEqual(
      { reply: 'yes', input: { src: 'order' } },
    );
    expect(parseReplyInput({ reply: 'pay' })).toEqual({ reply: 'pay', input: { src: 'order' } });
  });
});
