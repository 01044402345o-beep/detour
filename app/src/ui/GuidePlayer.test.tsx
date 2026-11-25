import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { GuideText } from '../data/guides';
import { t } from '../i18n';
import type { GuideEndReason, GuidePlayHandlers, GuideTts, GuideVoiceState } from '../speech/guideTts';
import { useAppStore } from '../store/useAppStore';
import type { Lang } from '../types';
import { GuidePlayer } from './GuidePlayer';

const GUIDE: GuideText = {
  en: [['Hello there.', 'This is stop one.'], ['Enjoy!']],
  ja: [['こんにちは。', '1か所目です。'], ['楽しんで！']],
  zh: [['你好。', '这是第1站。'], ['祝您愉快！']],
};

/** 가짜 가이드 엔진: play 호출을 기록하고, 테스트가 문장 시작·끝을 흉내 냄 */
function fakeTts(initial: GuideVoiceState = 'ready') {
  let state = initial;
  const calls: { sentences: readonly string[]; lang: Lang; rate: number; from: number }[] = [];
  let handlers: GuidePlayHandlers = {};
  const tts: GuideTts & { stops: number; setState: (s: GuideVoiceState) => void } = {
    stops: 0,
    setState: (s) => {
      state = s;
    },
    voiceState: () => state,
    init: () => Promise.resolve(state),
    play: (sentences, lang, rate, from, h = {}) => {
      handlers.onEnd?.('stopped');
      handlers = h;
      calls.push({ sentences, lang, rate, from });
      return 'started';
    },
    stop: () => {
      tts.stops++;
      const h = handlers;
      handlers = {};
      h.onEnd?.('stopped');
    },
    bindAutoCancel: () => () => {},
  };
  const sentence = (i: number) => act(() => handlers.onSentence?.(i));
  const end = (r: GuideEndReason) =>
    act(() => {
      const h = handlers;
      handlers = {};
      h.onEnd?.(r);
    });
  return { tts, calls, sentence, end };
}

function setup(lang: Lang = 'en', state: GuideVoiceState = 'ready') {
  useAppStore.setState({ lang });
  const f = fakeTts(state);
  render(
    <GuidePlayer guide={GUIDE} title="Old Downtown" buttonLabel="Listen" testId="g" tts={f.tts} />,
  );
  return f;
}

afterEach(() => useAppStore.setState({ lang: null }));

describe('GuidePlayer (T6.14)', () => {
  it('버튼(이모지 없음, 아이콘 + 문구) → 팝업이 열리며 바로 화면 언어로 처음부터 읽음', () => {
    const f = setup('en');
    const btn = screen.getByTestId('g');
    expect(btn).toHaveTextContent(/^Listen$/);
    expect(btn.querySelector('svg')).not.toBeNull();
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(btn);
    const dialog = screen.getByRole('dialog', { name: 'Old Downtown' });
    expect(dialog).toHaveTextContent('Hello there. This is stop one.');
    expect(dialog).toHaveTextContent('Enjoy!');
    expect(f.calls).toEqual([
      { sentences: ['Hello there.', 'This is stop one.', 'Enjoy!'], lang: 'en', rate: 1, from: 0 },
    ]);
    expect(screen.getByTestId('guide-toggle')).toHaveTextContent(t('en', 'guide.stop'));
    expect(screen.getByRole('status')).toHaveTextContent(t('en', 'guide.playing'));
  });

  it('지금 읽는 문장 강조, 멈추면 그 문장부터 이어 듣기, 끝까지 읽으면 처음부터', () => {
    const f = setup('en');
    fireEvent.click(screen.getByTestId('g'));
    f.sentence(1);
    expect(screen.getByTestId('guide-s-1')).toHaveClass('is-cur');
    expect(screen.getByTestId('guide-s-0')).not.toHaveClass('is-cur');
    // 멈춤
    fireEvent.click(screen.getByTestId('guide-toggle'));
    expect(f.tts.stops).toBe(1);
    expect(screen.getByTestId('guide-toggle')).toHaveTextContent(t('en', 'guide.resume'));
    // 이어 듣기 = 1번 문장부터
    fireEvent.click(screen.getByTestId('guide-toggle'));
    expect(f.calls.at(-1)?.from).toBe(1);
    // 끝까지
    f.end('done');
    expect(screen.getByTestId('guide-toggle')).toHaveTextContent(t('en', 'guide.play'));
    fireEvent.click(screen.getByTestId('guide-toggle'));
    expect(f.calls.at(-1)?.from).toBe(0);
  });

  it('천천히: 누르면 0.75배로 지금 문장부터 다시, aria-pressed', () => {
    const f = setup('en');
    fireEvent.click(screen.getByTestId('g'));
    f.sentence(2);
    const slow = screen.getByTestId('guide-slow');
    expect(slow).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(slow);
    expect(slow).toHaveAttribute('aria-pressed', 'true');
    expect(f.calls.at(-1)).toMatchObject({ rate: 0.75, from: 2 });
  });

  it('팝업을 닫으면 멈춤', () => {
    const f = setup('en');
    fireEvent.click(screen.getByTestId('g'));
    fireEvent.click(screen.getByRole('button', { name: t('en', 'common.close') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(f.tts.stops).toBeGreaterThan(0);
  });

  it.each([
    ['ja', ['こんにちは。', '1か所目です。', '楽しんで！'], 'ja'],
    ['zh', ['你好。', '这是第1站。', '祝您愉快！'], 'zh-Hans'],
  ] as const)('%s: 그 언어 원고를 그 언어로 읽고, 글에 lang 표시', (lang, sentences, tag) => {
    const f = setup(lang);
    fireEvent.click(screen.getByTestId('g'));
    expect(f.calls[0]).toMatchObject({ lang, sentences });
    const text = within(screen.getByRole('dialog')).getByText(sentences[0]).closest('div');
    expect(text).toHaveAttribute('lang', tag);
    expect(screen.getByTestId('guide-toggle')).toHaveTextContent(t(lang, 'guide.stop'));
  });

  it('그 언어 음성이 없으면 안내 문구(그래도 재생은 시도), 지원 안 하면 다른 안내', async () => {
    setup('ja', 'no-voice');
    fireEvent.click(screen.getByTestId('g'));
    expect(await screen.findByTestId('guide-notice')).toHaveTextContent(t('ja', 'guide.noVoice'));
  });

  it('재생이 오류로 끝나면 실패 안내, 다시 누르면 안내가 사라지고 재시도 (R1 M-02)', () => {
    const f = setup('en');
    fireEvent.click(screen.getByTestId('g'));
    f.end('error');
    expect(screen.getByTestId('guide-notice')).toHaveTextContent(t('en', 'guide.failed'));
    expect(screen.getByTestId('guide-toggle')).toHaveTextContent(t('en', 'guide.play'));
    fireEvent.click(screen.getByTestId('guide-toggle'));
    expect(f.calls).toHaveLength(2);
    expect(screen.queryByTestId('guide-notice')).toBeNull();
  });

  it('누를 때마다 음성 상태 재확인: 처음엔 없던 음성이 생기면 안내가 사라짐 (R1 M-03)', async () => {
    const f = setup('ja', 'no-voice');
    fireEvent.click(screen.getByTestId('g'));
    expect(await screen.findByTestId('guide-notice')).toHaveTextContent(t('ja', 'guide.noVoice'));
    fireEvent.click(screen.getByTestId('guide-toggle')); // 멈춤
    f.tts.setState('ready');
    fireEvent.click(screen.getByTestId('guide-toggle')); // 다시 재생
    expect(screen.queryByTestId('guide-notice')).toBeNull();
    // 반대로 사라지면 다시 안내
    f.tts.setState('no-voice');
    fireEvent.click(screen.getByTestId('guide-toggle'));
    fireEvent.click(screen.getByTestId('guide-toggle'));
    expect(screen.getByTestId('guide-notice')).toHaveTextContent(t('ja', 'guide.noVoice'));
  });

  it('팝업을 연 채 언어가 바뀌면 멈춘 위치를 버리고 새 언어 처음부터 (R1 L-02)', () => {
    const f = setup('en');
    fireEvent.click(screen.getByTestId('g'));
    f.sentence(2);
    act(() => useAppStore.setState({ lang: 'zh' }));
    expect(screen.getByTestId('guide-toggle')).toHaveTextContent(t('zh', 'guide.play'));
    fireEvent.click(screen.getByTestId('guide-toggle'));
    expect(f.calls.at(-1)).toMatchObject({ lang: 'zh', from: 0 });
  });

  it('음성 확인이 늦게 끝났는데 그 사이 언어가 바뀌었으면 이전 언어 결과를 버림 (R2 L-02)', async () => {
    useAppStore.setState({ lang: 'en' });
    let resolveEn: (s: GuideVoiceState) => void = () => {};
    const f = fakeTts('ready');
    const tts: GuideTts = {
      ...f.tts,
      voiceState: (l) => (l === 'en' ? null : 'ready'),
      init: (l) =>
        l === 'en'
          ? new Promise<GuideVoiceState>((r) => {
              resolveEn = r;
            })
          : Promise.resolve('ready'),
    };
    render(<GuidePlayer guide={GUIDE} title="T" buttonLabel="Listen" testId="g" tts={tts} />);
    fireEvent.click(screen.getByTestId('g'));
    act(() => useAppStore.setState({ lang: 'ja' }));
    await act(async () => resolveEn('no-voice'));
    expect(screen.queryByTestId('guide-notice')).toBeNull();
  });

  it('언어를 바꾸면 재생을 멈춤', () => {
    const f = setup('en');
    fireEvent.click(screen.getByTestId('g'));
    act(() => useAppStore.setState({ lang: 'ja' }));
    expect(f.tts.stops).toBeGreaterThan(0);
  });
});
