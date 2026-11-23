import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../router/AppRoutes';
import { STORAGE_KEY, useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';

vi.mock('../../router/screens', async () => {
  const { SCREEN_KEYS } = await import('../../domain/events');
  const Settings = (await import('./index')).default;
  return {
    SCREENS: Object.fromEntries(
      SCREEN_KEYS.map((k) => [
        k,
        k === 'settings' ? Settings : () => <section data-testid={`screen-${k}`} />,
      ]),
    ),
  };
});

async function renderSettings(lang: Lang = 'en') {
  useAppStore.setState({ lang, events: [] });
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return screen.findByTestId('screen-settings');
}

afterEach(() => {
  useAppStore.setState({
    lang: null,
    events: [],
    reports: [],
    cart: {},
    currentPlaceId: null,
    saved: { places: [], phrases: [] },
  });
  localStorage.clear();
});

const radio = (name: string) => screen.getByRole('radio', { name });

describe('S12 설정 — 언어 즉시 전환', () => {
  it('현재 언어가 선택 표시', async () => {
    await renderSettings('ja');
    expect(radio('日本語')).toBeChecked();
    expect(radio('English')).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('設定');
  });

  it('언어를 바꾸면 화면·탭바 문구가 바로 바뀌고 저장됨', async () => {
    await renderSettings('en');
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /Me/ })).toBeInTheDocument();
    fireEvent.click(radio('简体中文'));
    expect(useAppStore.getState().lang).toBe('zh');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('设置');
    expect(within(nav).getByRole('link', { name: /我的/ })).toHaveAttribute('aria-current', 'page');
    expect(radio('简体中文')).toBeChecked();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"lang":"zh"');
  });

  it('언어 이름은 화면 언어와 관계없이 자기 이름(endonym)', async () => {
    await renderSettings('zh');
    expect(radio('English')).toBeInTheDocument();
    expect(radio('日本語')).toBeInTheDocument();
  });
});

describe('S12 설정 — 운영자 리포트 진입', () => {
  it('누르면 /report (S13)', async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Operator report' }));
    expect(await screen.findByTestId('screen-report')).toBeInTheDocument();
  });
});

describe('S12 설정 — 데모 데이터 초기화', () => {
  const seed = () =>
    useAppStore.setState({
      cart: { ssd: { tw: 2 } },
      currentPlaceId: 'ssd',
      saved: { places: ['ssd'], phrases: ['ssd-1'] },
      reports: [{ kind: 'price', placeId: 'ssd', t: 1 }],
    });

  it('확인 시트에서 취소하면 아무것도 지우지 않음', async () => {
    await renderSettings();
    seed();
    fireEvent.click(screen.getByTestId('reset-data'));
    const dialog = screen.getByRole('dialog', { name: 'Reset demo data' });
    expect(dialog).toHaveTextContent('Delete all demo data on this device and start over?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useAppStore.getState().saved.places).toEqual(['ssd']);
    expect(screen.getByTestId('screen-settings')).toBeInTheDocument();
  });

  it('확인하면 주문·저장·제보·기록을 비우고(언어 유지) 언어 선택 화면 + 완료 토스트', async () => {
    await renderSettings('ja');
    seed();
    fireEvent.click(screen.getByTestId('reset-data'));
    fireEvent.click(screen.getByTestId('reset-confirm'));
    const s = useAppStore.getState();
    expect(s.cart).toEqual({});
    expect(s.currentPlaceId).toBeNull();
    expect(s.saved).toEqual({ places: [], phrases: [] });
    expect(s.reports).toEqual([]);
    expect(s.lang).toBe('ja');
    expect(await screen.findByTestId('screen-lang')).toBeInTheDocument();
    expect(screen.getByTestId('toast-region')).toHaveTextContent('デモデータをリセットしました。');
    // 초기화 뒤에는 새 화면(언어 선택)의 screen_view만 남음
    expect(useAppStore.getState().events).toEqual([
      expect.objectContaining({ type: 'screen_view', screen: 'lang' }),
    ]);
  });
});

describe('S12 설정 — 개인정보·정정 안내', () => {
  it('개인정보 안내와 가게 정보 정정·삭제 안내 자리를 표시', async () => {
    await renderSettings();
    expect(screen.getByText(/Your voice is never saved/)).toBeInTheDocument();
    expect(screen.getByTestId('takedown')).toHaveTextContent(/corrected or removed/);
    // 연락처 값은 T4.4에서 확정 → 지금은 표시하지 않음
    expect(screen.queryByTestId('takedown-contact')).toBeNull();
  });
});

describe('S12 설정 — 네이티브 radio 그룹 (R1 M-01)', () => {
  // 방향키·순환·단일 Tab 진입은 네이티브 radio의 브라우저 기본 동작(jsdom 미재현). 전제만 검사.
  it('같은 name의 radio 3개, 그룹 이름 = 언어 제목, 하나만 checked', async () => {
    await renderSettings('ja');
    const group = screen.getByRole('radiogroup', { name: '言語' });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => r.tagName === 'INPUT' && r.name === 'set-lang')).toBe(true);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(['ja']);
  });

  it('다음 radio change → 즉시 전환·저장, 이전 항목 해제', async () => {
    await renderSettings('zh');
    fireEvent.click(radio('English'));
    expect(useAppStore.getState().lang).toBe('en');
    expect(radio('English')).toBeChecked();
    expect(radio('简体中文')).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings');
  });

  it('라벨(행 전체)을 눌러도 선택', async () => {
    await renderSettings('en');
    fireEvent.click(screen.getByTestId('set-lang-ja'));
    expect(useAppStore.getState().lang).toBe('ja');
    expect(screen.getByTestId('set-lang-ja')).toHaveClass('set-opt--on');
  });
});
