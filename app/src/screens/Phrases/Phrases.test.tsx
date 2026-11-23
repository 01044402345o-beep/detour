import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { places } from '../../data';
import { PATHS } from '../../router/routes';
import type { SpeakResult, Tts } from '../../speech/tts';
import { STORAGE_KEY, useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import { ToastProvider } from '../../ui';
import PhrasesScreen from './index';
import { logOrWarn } from './logOrWarn';

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

function PracticeProbe() {
  const { state } = useLocation();
  return <section data-testid="screen-practice">{JSON.stringify(state)}</section>;
}

function renderPhrases(lang: Lang = 'en') {
  useAppStore.setState({ lang });
  return render(
    <MemoryRouter initialEntries={[PATHS.phrases]}>
      <ToastProvider>
        <Routes>
          <Route path={PATHS.phrases} element={<PhrasesScreen />} />
          <Route path={PATHS.practice} element={<PracticeProbe />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const row = (id: string) => document.querySelector(`[data-phrase-id="${id}"]`) as HTMLElement;

beforeEach(() => {
  useAppStore.getState().resetData();
  vi.clearAllMocks();
});
afterEach(() => {
  useAppStore.getState().resetData();
  useAppStore.setState({ lang: null });
});

describe('S10 문장 모음', () => {
  it('코스 4곳을 순서대로, 장소별 모든 문장(ko·발음·뜻)을 보여 줌', () => {
    renderPhrases();
    expect(screen.getByTestId('screen-phrases')).toBeInTheDocument();
    const heads = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(heads).toEqual(places.map((p) => `${p.order}${p.name.en}`));
    const total = places.reduce((n, p) => n + p.phrases.length, 0);
    expect(document.querySelectorAll('[data-phrase-id]')).toHaveLength(total);
    const ph = places[0].phrases[0];
    expect(row(ph.id)).toHaveTextContent(ph.ko);
    expect(row(ph.id)).toHaveTextContent(ph.roman);
    expect(row(ph.id)).toHaveTextContent(ph.meaning.en);
  });

  it('JA: 가타카나 발음·일본어 뜻', () => {
    renderPhrases('ja');
    const ph = places[3].phrases[1];
    expect(row(ph.id)).toHaveTextContent(ph.kana);
    expect(row(ph.id)).toHaveTextContent(ph.meaning.ja);
    expect(row(ph.id)).not.toHaveTextContent(ph.roman);
  });

  it('듣기 → TTS speak(ko) + phrase_play(실제 장소·문장 ID)', () => {
    renderPhrases();
    const ph = places[3].phrases[1];
    fireEvent.click(within(row(ph.id)).getByRole('button', { name: 'Listen' }));
    expect(tts.speak).toHaveBeenCalledWith(ph.ko, 1, expect.any(Function));
    expect(useAppStore.getState().events).toEqual([
      expect.objectContaining({
        type: 'phrase_play',
        src: 'phrase',
        placeId: places[3].id,
        phraseId: ph.id,
      }),
    ]);
  });

  it('TTS 시작 실패면 phrase_play를 남기지 않음', () => {
    tts.speak.mockReturnValueOnce('unsupported');
    renderPhrases();
    fireEvent.click(within(row('ssd-1')).getByRole('button', { name: 'Listen' }));
    expect(useAppStore.getState().events).toEqual([]);
  });

  it('문장 누르기 → /practice, state { src:"phrase", phraseId }', () => {
    renderPhrases();
    fireEvent.click(screen.getByRole('button', { name: 'Practice: 덜 맵게 해 주세요' }));
    expect(screen.getByTestId('screen-practice')).toHaveTextContent(
      JSON.stringify({ src: 'phrase', phraseId: 'gwc-2' }),
    );
  });

  it('북마크 추가·해제: aria-pressed, 토스트, store·localStorage 반영 (새로고침 후 유지)', () => {
    renderPhrases();
    const bm = row('eun-2').querySelector('.phr-bm')!;
    expect(bm).toHaveAttribute('aria-pressed', 'false');
    expect(bm).toHaveAccessibleName('Save this phrase');
    fireEvent.click(bm);
    expect(useAppStore.getState().saved.phrases).toEqual(['eun-2']);
    expect(bm).toHaveAttribute('aria-pressed', 'true');
    expect(bm).toHaveAccessibleName('Remove from saved');
    expect(screen.getByTestId('toast-region')).toHaveTextContent('Saved');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.saved.phrases).toEqual(['eun-2']);
    fireEvent.click(bm);
    expect(useAppStore.getState().saved.phrases).toEqual([]);
    expect(screen.getByTestId('toast-region')).toHaveTextContent('Removed');
  });

  it('저장된 문장은 처음부터 눌린 상태로 표시', () => {
    useAppStore.setState({ saved: { places: [], phrases: ['mus-1'] } });
    renderPhrases();
    const bm = row('mus-1').querySelector('.phr-bm')!;
    expect(bm).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('logOrWarn', () => {
  it('logEvent가 false면 개발 모드에서 경고', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(logOrWarn(() => false, { type: 'place_view', placeId: 'ssd' })).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(logOrWarn(() => true, { type: 'place_view', placeId: 'ssd' })).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
