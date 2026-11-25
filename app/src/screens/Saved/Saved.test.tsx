import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { getPlace } from '../../data';
import { PATHS } from '../../router/routes';
import type { SpeakResult, Tts } from '../../speech/tts';
import { useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import { ToastProvider } from '../../ui';
import SavedScreen from './index';

const tts = {
  init: vi.fn(async () => 'ready' as const),
  getState: vi.fn(() => 'ready' as const),
  speak: vi.fn((): SpeakResult => 'started'),
  cancel: vi.fn(),
  bindAutoCancel: vi.fn(() => () => {}),
} satisfies Tts;

vi.mock('../../speech/tts', async (orig) => ({
  ...(await orig<typeof import('../../speech/tts')>()),
  getTts: () => tts,
}));

function PlaceProbe() {
  const { id } = useParams();
  return <section data-testid="screen-place">{id}</section>;
}

function renderSaved(lang: Lang = 'en') {
  useAppStore.setState({ lang });
  return render(
    <MemoryRouter initialEntries={[PATHS.saved]}>
      <ToastProvider>
        <Routes>
          <Route path={PATHS.saved} element={<SavedScreen />} />
          <Route path={PATHS.place} element={<PlaceProbe />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const placeRow = (id: string) => document.querySelector(`[data-place-id="${id}"]`) as HTMLElement;
const phraseRow = (id: string) => document.querySelector(`[data-phrase-id="${id}"]`) as HTMLElement;

beforeEach(() => {
  useAppStore.getState().resetData();
  vi.clearAllMocks();
});
afterEach(() => {
  useAppStore.getState().resetData();
  useAppStore.setState({ lang: null });
});

describe('S11 저장 · 제보', () => {
  it('저장한 것이 없으면 빈 안내 + 제보 버튼은 계속 보임', () => {
    renderSaved();
    expect(screen.getByTestId('saved-empty')).toHaveTextContent('Nothing saved yet');
    expect(screen.getByRole('button', { name: /Info looks wrong\?/ })).toBeInTheDocument();
  });

  it('빈 화면에 저장 방법 안내: 저장(북마크) 아이콘 + 설명 (T6.6)', () => {
    renderSaved();
    const empty = screen.getByTestId('saved-empty');
    expect(empty).toHaveTextContent(
      'Tap the save button on a place or a phrase, and it will be kept here.',
    );
    // 아이콘 견본은 장식(설명 글이 같은 내용) — 누를 수 있는 버튼이 아님
    const how = empty.querySelector('.sav-empty__how')!;
    expect(how).toHaveAttribute('aria-hidden', 'true');
    expect(how.querySelector('svg path')).toHaveAttribute('d', 'M6 3h12v18l-6-4-6 4V3z');
    expect(within(empty).queryByRole('button')).toBeNull();
  });

  it('빈 화면 안내 JA (T6.6)', () => {
    renderSaved('ja');
    expect(screen.getByTestId('saved-empty')).toHaveTextContent(
      '場所やフレーズの保存ボタンを押すと、ここに集まります。',
    );
  });

  it('저장한 장소·문장을 데이터 순서로, 데이터에 없는 ID는 숨김', () => {
    useAppStore.setState({
      saved: { places: ['gwc', 'ghost', 'ssd'], phrases: ['gwc-3', 'ssd-2', 'x-9'] },
    });
    renderSaved();
    expect(screen.queryByTestId('saved-empty')).not.toBeInTheDocument();
    const placeIds = [...document.querySelectorAll('[data-place-id]')].map((e) =>
      e.getAttribute('data-place-id'),
    );
    expect(placeIds).toEqual(['ssd', 'gwc']);
    const phraseIds = [...document.querySelectorAll('[data-phrase-id]')].map((e) =>
      e.getAttribute('data-phrase-id'),
    );
    expect(phraseIds).toEqual(['ssd-2', 'gwc-3']);
    const ssd = getPlace('ssd')!;
    expect(placeRow('ssd')).toHaveTextContent(ssd.name.en);
    expect(placeRow('ssd')).toHaveTextContent(ssd.nameKo);
    expect(placeRow('ssd')).toHaveTextContent('Not yet verified on site · sample info');
    expect(phraseRow('ssd-2')).toHaveTextContent('포장해 주세요');
  });

  it('장소 누르기 → 장소 상세(/place/:id)', () => {
    useAppStore.setState({ saved: { places: ['mus'], phrases: [] } });
    renderSaved();
    fireEvent.click(within(placeRow('mus')).getByRole('link'));
    expect(screen.getByTestId('screen-place')).toHaveTextContent('mus');
  });

  it('장소·문장 저장 해제 → 목록에서 빠지고 토스트', () => {
    useAppStore.setState({ saved: { places: ['ssd'], phrases: ['eun-1'] } });
    renderSaved();
    fireEvent.click(within(placeRow('ssd')).getByRole('button', { name: 'Remove from saved' }));
    expect(useAppStore.getState().saved.places).toEqual([]);
    expect(placeRow('ssd')).toBeNull();
    expect(screen.getByTestId('toast-region')).toHaveTextContent('Removed');
    fireEvent.click(within(phraseRow('eun-1')).getByRole('button', { name: 'Remove from saved' }));
    expect(useAppStore.getState().saved.phrases).toEqual([]);
    expect(screen.getByTestId('saved-empty')).toBeInTheDocument();
  });

  it('저장한 문장 듣기 → phrase_play 기록', () => {
    useAppStore.setState({ saved: { places: [], phrases: ['gwc-1'] } });
    renderSaved();
    fireEvent.click(within(phraseRow('gwc-1')).getByRole('button', { name: 'Listen' }));
    expect(tts.speak).toHaveBeenCalledWith('두 명이에요', 1, expect.any(Function));
    expect(useAppStore.getState().events).toEqual([
      expect.objectContaining({
        type: 'phrase_play',
        src: 'phrase',
        placeId: 'gwc',
        phraseId: 'gwc-1',
      }),
    ]);
  });

  it('"정보가 달라요" → 제보 시트 → 항목 선택 → reports +1·report_sent·감사 토스트', () => {
    renderSaved();
    fireEvent.click(screen.getByRole('button', { name: /Info looks wrong\?/ }));
    const dialog = screen.getByRole('dialog', { name: 'What is different?' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Menu changed/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const s = useAppStore.getState();
    expect(s.reports).toEqual([{ kind: 'menu', t: expect.any(Number) }]);
    expect(s.events.filter((e) => e.type === 'report_sent')).toHaveLength(1);
    expect(screen.getByTestId('toast-region')).toHaveTextContent("Thanks! We'll re-check it.");
  });

  it('제보 시트는 닫기 버튼으로 기록 없이 닫힘', () => {
    renderSaved();
    fireEvent.click(screen.getByRole('button', { name: /Info looks wrong\?/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useAppStore.getState().reports).toEqual([]);
  });

  it('ZH 문구', () => {
    useAppStore.setState({ saved: { places: ['eun'], phrases: [] } });
    renderSaved('zh');
    expect(placeRow('eun')).toHaveTextContent(getPlace('eun')!.name.zh);
  });
});
