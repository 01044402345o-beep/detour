import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PHOTOS } from '../../data/photos';
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
    expect(within(nav).getByRole('link', { name: /Settings/ })).toBeInTheDocument();
    fireEvent.click(radio('简体中文'));
    expect(useAppStore.getState().lang).toBe('zh');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('设置');
    expect(within(nav).getByRole('link', { name: /设置/ })).toHaveAttribute('aria-current', 'page');
    expect(radio('简体中文')).toBeChecked();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"lang":"zh"');
  });

  it('언어 이름은 화면 언어와 관계없이 자기 이름(endonym)', async () => {
    await renderSettings('zh');
    expect(radio('English')).toBeInTheDocument();
    expect(radio('日本語')).toBeInTheDocument();
  });
});

const openDemoTools = () => fireEvent.click(screen.getByRole('button', { name: 'Demo tools' }));

describe('S12 설정 — 시연 도구 (T6.6, 기본 접힘)', () => {
  it('처음에는 접혀 있어 리포트·초기화가 보이지 않음, 누르면 펼치고 다시 누르면 접음', async () => {
    await renderSettings();
    const toggle = screen.getByTestId('demo-tools');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(panel).not.toBeVisible();
    expect(screen.queryByTestId('open-report')).toBeNull();
    expect(screen.queryByTestId('reset-data')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Operator report' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Reset demo data' })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('open-report')).toBeNull();
  });

  it('묶음 이름은 화면 언어로 (ja)', async () => {
    await renderSettings('ja');
    expect(screen.getByTestId('demo-tools')).toHaveTextContent('デモ用ツール');
  });
});

describe('S12 설정 — 운영자 리포트 진입', () => {
  it('시연 도구를 펼치고 누르면 /report (S13)', async () => {
    await renderSettings();
    openDemoTools();
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
    openDemoTools();
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
    fireEvent.click(screen.getByTestId('demo-tools'));
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

describe('S12 설정 — 사진 출처 시트 (T6.6, 새 경로 없음)', () => {
  const openCredits = () => {
    const row = screen.getByRole('button', { name: /Photo credits/ });
    row.focus();
    fireEvent.click(row);
    return row;
  };

  it('행을 누르면 시트가 열리고, 사진 11장(장소 CC 6 + 직접 촬영 2 + 음식 예시 3)의 장소·제목·저작자·라이선스 링크·원본 링크·고지·변경 내역', async () => {
    await renderSettings();
    openCredits();
    const dialog = screen.getByRole('dialog', { name: 'Photo credits' });
    expect(dialog).toHaveTextContent('These licenses apply only to the photo files.');
    const items = within(dialog).getAllByRole('listitem');
    expect(items).toHaveLength(PHOTOS.length);
    expect(PHOTOS).toHaveLength(11);
    PHOTOS.forEach((p, i) => {
      const it = items[i];
      expect(it).toHaveAttribute('data-photo-id', p.id);
      expect(it).toHaveTextContent(p.title);
      expect(it).toHaveTextContent(p.changes);
      if (p.notice) expect(it).toHaveTextContent(p.notice);
      if (p.sourceUrl === undefined) {
        // 운영자 직접 촬영(T6.10): CC 아님 → 라이선스·원본 링크 없이 화면 언어 문구
        expect(it).toHaveTextContent('Edulleo team (own photo)');
        expect(within(it).getByTestId('credit-license-own')).toHaveTextContent(
          'Own photo, used with permission (not a Creative Commons license)',
        );
        expect(within(it).queryAllByRole('link')).toHaveLength(0);
        expect(it).not.toHaveTextContent('Original file');
        return;
      }
      expect(it).toHaveTextContent(p.author);
      const license = within(it).getByRole('link', { name: p.licenseId });
      expect(license).toHaveAttribute('href', p.licenseUrl);
      expect(license).toHaveAttribute('target', '_blank');
      expect(license).toHaveAttribute('rel', expect.stringContaining('noopener'));
      const file = decodeURIComponent(p.sourceUrl.split('/wiki/')[1]).replace(/_/g, ' ');
      expect(file).toMatch(/^File:.+\.jpg$/);
      const source = within(it).getByRole('link', { name: file });
      expect(source).toHaveAttribute('href', p.sourceUrl);
      // 같은 정보(장소 이름)가 옆 글자로 있으므로 썸네일은 빈 alt
      expect(it.querySelector('img')).toHaveAttribute('alt', '');
      expect(it.querySelector('img')).toHaveAttribute('loading', 'lazy');
    });
    // 장소 이름: 장소 데이터(성심당·대전역 출발지)와 권역 번역 키(중앙시장·유성)
    const places = within(dialog)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(places).toHaveLength(11);
    expect(places[0]).toMatch(/Sungsimdang/);
    expect(places).toEqual(
      expect.arrayContaining([
        'Daejeon Station',
        'Daejeon Jungang Market',
        'Yuseong Spa foot bath',
      ]),
    );
    // 새 경로를 만들지 않음
    expect(screen.getByTestId('screen-settings')).toBeInTheDocument();
  });

  it('라벨은 화면 언어, 라이선스명·저작자는 데이터 그대로 (ja)', async () => {
    await renderSettings('ja');
    fireEvent.click(screen.getByTestId('open-photo-credits'));
    const dialog = screen.getByRole('dialog', { name: '写真のクレジット' });
    expect(within(dialog).getAllByText('撮影者')).toHaveLength(11);
    expect(within(dialog).getAllByText('元の題名')).toHaveLength(11);
    expect(within(dialog).getAllByRole('link', { name: 'CC BY-SA 4.0' })).toHaveLength(5);
    expect(within(dialog).getAllByRole('link', { name: 'CC BY-SA 2.5' })).toHaveLength(1);
    expect(within(dialog).getByRole('heading', { name: '大田中央市場' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Trainholic');
    // 음식 예시 사진(T6.9): BY와 BY-SA 링크 구분, 예시 표시 일본어
    // CC BY 2.0 KR 사진(두부두루치기·고추튀김)은 R1 H-01로 제외
    expect(within(dialog).queryAllByRole('link', { name: 'CC BY 2.0 KR' })).toHaveLength(0);
    expect(within(dialog).getAllByRole('link', { name: 'CC BY 2.0' })).toHaveLength(1);
    expect(within(dialog).getAllByRole('link', { name: 'CC BY-SA 2.0' })).toHaveLength(1);
    expect(within(dialog).getAllByRole('link', { name: 'CC BY-SA 2.0 KR' })).toHaveLength(1);
    expect(within(dialog).getAllByTestId('credit-dish-example')[0]).toHaveTextContent(
      'マンドゥスープのイメージ写真 · この店で撮影したものではありません',
    );
    // 운영자 직접 촬영(T6.10): 일본어 저작자·이용 조건 문구, 링크 없음
    const own = within(dialog).getAllByTestId('credit-license-own');
    expect(own).toHaveLength(2);
    expect(own[0]).toHaveTextContent(
      '運営チームが撮影し、許可を得て使用(クリエイティブ・コモンズではありません)',
    );
    expect(dialog).toHaveTextContent('Edulleo運営チーム(自ら撮影)');
    expect(dialog).not.toHaveTextContent('Edulleo 운영자');
  });

  it('운영자 직접 촬영(T6.10): 광천식당·수연분식 항목은 장소 사진(kind place), 예시 표시 없음', async () => {
    await renderSettings();
    openCredits();
    const dialog = screen.getByRole('dialog', { name: 'Photo credits' });
    for (const [id, name] of [
      ['own-gwangcheon-sikdang', 'Gwangcheon Sikdang'],
      ['own-suyeon-bunsik', 'Suyeon Bunsik'],
    ]) {
      const item = dialog.querySelector(`[data-photo-id="${id}"]`)!;
      expect(item).toHaveAttribute('data-photo-kind', 'place');
      expect(within(item as HTMLElement).getByRole('heading', { level: 3 })).toHaveTextContent(
        name,
      );
      expect(within(item as HTMLElement).queryByTestId('credit-dish-example')).toBeNull();
    }
  });

  it('음식 예시 사진(T6.9): 시트에서 장소 사진과 구분 표시(음식 이름 + 이 가게 사진 아님)', async () => {
    await renderSettings();
    openCredits();
    const dialog = screen.getByRole('dialog', { name: 'Photo credits' });
    const items = within(dialog).getAllByRole('listitem');
    PHOTOS.forEach((p, i) => {
      expect(items[i]).toHaveAttribute('data-photo-kind', p.kind);
      const mark = within(items[i]).queryByTestId('credit-dish-example');
      if (p.kind === 'dish-example') {
        expect(mark).toHaveTextContent(`Example photo of ${p.dish.en} · not taken at this shop`);
      } else {
        expect(mark).toBeNull();
      }
    });
    const gc = items.find((el) => el.getAttribute('data-photo-id') === 'dish-manduguk')!;
    expect(within(gc).getByRole('heading', { level: 3 })).toHaveTextContent('Gaecheon Sikdang');
    expect(within(gc).getByRole('link', { name: 'CC BY-SA 2.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/2.0/',
    );
    expect(
      within(gc).getByRole('link', { name: 'File:Korean.cuisine-Manduguk-01.jpg' }),
    ).toBeInTheDocument();
    const sj = items.find((el) => el.getAttribute('data-photo-id') === 'dish-sundae-gukbap')!;
    expect(within(sj).getByRole('link', { name: 'CC BY 2.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/2.0/',
    );
    expect(within(dialog).getAllByTestId('credit-dish-example')).toHaveLength(3);
  });

  it('닫기 버튼 → 시트 닫힘, 쌓은 기록 한 칸을 되돌리고(history.back) 초점은 행으로', async () => {
    await renderSettings();
    const back = vi.spyOn(window.history, 'back');
    const before = window.history.length;
    const row = openCredits();
    expect(window.history.length).toBe(before + 1);
    const dialog = screen.getByRole('dialog', { name: 'Photo credits' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);
    expect(row).toHaveFocus();
    back.mockRestore();
  });

  it('Esc로 닫아도 초점이 행으로 돌아옴', async () => {
    await renderSettings();
    const row = openCredits();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(row).toHaveFocus();
  });

  it('뒤로가기(popstate) → 설정 화면에 머문 채 시트만 닫히고 초점은 행으로, screen_view 중복 없음', async () => {
    await renderSettings();
    const views = () => useAppStore.getState().events.filter((e) => e.type === 'screen_view');
    const viewsBefore = views().length;
    const row = openCredits();
    expect(screen.getByRole('dialog', { name: 'Photo credits' })).toBeInTheDocument();
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('screen-settings')).toBeInTheDocument();
    expect(row).toHaveFocus();
    expect(views()).toHaveLength(viewsBefore);
    // 이미 되돌아왔으므로 다시 열고 닫아도 정상
    openCredits();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('S12 설정 — 탭바 이름과 화면 제목 (DESIGN.md 6장)', () => {
  it.each<[Lang, string]>([
    ['en', 'Settings'],
    ['ja', '設定'],
    ['zh', '设置'],
  ])('%s: 탭 이름 = 화면 제목 = %s', async (lang, name) => {
    await renderSettings(lang);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(name);
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
  });
});
