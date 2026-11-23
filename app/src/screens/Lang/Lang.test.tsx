import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../router/AppRoutes';
import { STORAGE_KEY, useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';

// 다른 화면 task의 화면은 빈 화면으로 바꿔 이 task 화면만 검사합니다.
vi.mock('../../router/screens', async () => {
  const { SCREEN_KEYS } = await import('../../domain/events');
  const Lang = (await import('./index')).default;
  return {
    SCREENS: Object.fromEntries(
      SCREEN_KEYS.map((k) => [
        k,
        k === 'lang' ? Lang : () => <section data-testid={`screen-${k}`} />,
      ]),
    ),
  };
});

function renderAt(path: string, lang: Lang | null) {
  useAppStore.setState({ lang, events: [] });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAppStore.setState({ lang: null, events: [] });
  localStorage.clear();
});

const radio = (name: string) => screen.getByRole('radio', { name });

describe('S00 언어 선택', () => {
  it('첫 실행(lang null)이면 /lang으로 열리고 EN이 기본 선택, 문구는 영어', async () => {
    renderAt('/', null);
    expect(await screen.findByTestId('screen-lang')).toBeInTheDocument();
    expect(radio('English')).toBeChecked();
    expect(radio('日本語')).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Get started/ })).toBeInTheDocument();
    expect(screen.getByTestId('lang-pron-note')).toHaveTextContent('romanized Korean');
  });

  it('언어를 누르면 즉시 저장되고 이 화면 문구가 바로 바뀜 (JA → 가타카나 안내)', async () => {
    renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    fireEvent.click(radio('日本語'));
    expect(useAppStore.getState().lang).toBe('ja');
    expect(radio('日本語')).toBeChecked();
    expect(radio('English')).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('言語を選んでください');
    expect(screen.getByTestId('lang-pron-note')).toHaveTextContent('カタカナ');
    // 새로고침 후 유지(persist)
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"lang":"ja"');
  });

  it('ZH를 고르면 중국어 문구 + 로마자(병음 아님) 안내', async () => {
    renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    fireEvent.click(radio('简体中文'));
    expect(useAppStore.getState().lang).toBe('zh');
    expect(screen.getByTestId('lang-pron-note')).toHaveTextContent('拼音');
  });

  it('고르지 않고 시작하기 → 기본 언어(EN) 저장 후 홈', async () => {
    renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    fireEvent.click(screen.getByRole('button', { name: /Get started/ }));
    expect(useAppStore.getState().lang).toBe('en');
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
  });

  it('고른 언어로 시작하기 → 홈, 언어 유지', async () => {
    renderAt('/lang', 'en');
    await screen.findByTestId('screen-lang');
    fireEvent.click(radio('简体中文'));
    fireEvent.click(screen.getByRole('button', { name: /开始/ }));
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument();
    expect(useAppStore.getState().lang).toBe('zh');
  });

  it('탭바가 없고 화면에서 screen_view를 직접 기록하지 않음(라우터가 1회)', async () => {
    renderAt('/lang', null);
    await screen.findByTestId('screen-lang');
    expect(screen.queryByRole('navigation')).toBeNull();
    const views = useAppStore.getState().events.filter((e) => e.type === 'screen_view');
    expect(views).toHaveLength(1);
  });
});

describe('S00 언어 선택 — 네이티브 radio 그룹 (R1 M-01)', () => {
  // 방향키 이동·끝↔처음 순환·선택 항목 하나로만 Tab 진입은 같은 name의 네이티브 radio가 주는
  // 브라우저 기본 동작입니다. jsdom은 이 키보드 동작을 재현하지 않으므로 여기서는 그 전제
  // (같은 name의 radio 3개, 하나만 checked, change → 즉시 전환)를 검사합니다.
  it('같은 name의 radio 3개, 그룹 이름 = 안내 제목, 하나만 checked', async () => {
    renderAt('/lang', 'zh');
    await screen.findByTestId('screen-lang');
    const group = screen.getByRole('radiogroup', { name: '请选择语言' });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => r.type === 'radio' && r.name === 'lang-choose')).toBe(true);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(['zh']);
  });

  it('방향키 이동과 같은 change(다음 radio 선택) → store·문구 즉시 전환, 이전 항목 해제', async () => {
    renderAt('/lang', 'en');
    await screen.findByTestId('screen-lang');
    fireEvent.click(radio('日本語')); // 브라우저는 ArrowDown 시 다음 radio에 click/change를 보냄
    expect(useAppStore.getState().lang).toBe('ja');
    expect(radio('日本語')).toBeChecked();
    expect(radio('English')).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('言語を選んでください');
  });

  it('라벨(카드 전체)을 눌러도 선택 — 44px 카드가 클릭 영역', async () => {
    renderAt('/lang', 'en');
    await screen.findByTestId('screen-lang');
    fireEvent.click(screen.getByTestId('lang-zh'));
    expect(useAppStore.getState().lang).toBe('zh');
    expect(screen.getByTestId('lang-zh')).toHaveClass('lang-opt--on');
  });

  it('radio는 button이 아니고 별도 Tab 정지점(tabIndex) 조작 없음', async () => {
    renderAt('/lang', 'en');
    await screen.findByTestId('screen-lang');
    for (const r of screen.getAllByRole('radio')) {
      expect(r.tagName).toBe('INPUT');
      expect(r).not.toHaveAttribute('tabindex');
    }
    // 화면의 button은 시작하기 하나뿐 (언어 항목이 Tab 순서에 3번 끼지 않음)
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
