import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { places } from '../../data';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { googlePlaceUrl, naverWalkUrl } from '../../ui/map/externalMap';
import CourseScreen from '.';

// 확인 상태 두 갈래를 모두 보려고 성심당(ssd)만 verified:true로 바꿉니다(실제 데이터는 4곳 모두 false).
vi.mock('../../data', async (importOriginal) => {
  const m = await importOriginal<typeof import('../../data')>();
  const list = m.places.map((p) => (p.id === 'ssd' ? { ...p, verified: true } : p));
  return { ...m, places: list, getPlace: (id: string) => list.find((p) => p.id === id) };
});

// 타일 지도 대신 약도로 고정 (Leaflet 동작은 ui/map 테스트)
let onLine = false;
beforeAll(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => onLine);
});

function Probe() {
  const loc = useLocation();
  return <div data-testid="probe">{loc.pathname}</div>;
}

function renderCourse() {
  return render(
    <MemoryRouter initialEntries={['/course']}>
      <Routes>
        <Route path="/course" element={<CourseScreen />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const byId = (id: string) => places.find((p) => p.id === id)!;

beforeEach(() => {
  onLine = false;
  useAppStore.setState({ lang: 'en', events: [] });
});
afterEach(() => useAppStore.setState({ lang: null, events: [] }));

describe('S02 코스 지도', () => {
  it('E2E용 화면 루트 testid 유지, 제목·요약은 사용자 언어', () => {
    renderCourse();
    const root = screen.getByTestId('screen-course');
    expect(root.tagName).toBe('SECTION');
    expect(screen.getAllByText('Old Downtown Half-day').length).toBeGreaterThan(0);
    expect(
      screen.getByText(t('en', 'course.meta', { stops: 4, km: '2.0', hours: '3' })),
    ).toBeInTheDocument();
    expect(screen.getByText(t('en', 'course.from'))).toBeInTheDocument();
  });

  it('정류장 4곳이 방문 순서대로, 각각 이동 시간 표시', () => {
    renderCourse();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    ['ssd', 'eun', 'mus', 'gwc'].forEach((id, i) => {
      const p = byId(id);
      expect(items[i]).toHaveTextContent(p.name.en);
      expect(items[i]).toHaveTextContent(p.nameKo);
      expect(items[i]).toHaveTextContent(t('en', 'course.walkMin', { min: p.walkMinFromPrev }));
    });
  });

  it('확인 상태: verified면 "확인일 YYYY-MM-DD", 아니면 날짜 없이 "현장 확인 전 · 예시 정보"', () => {
    renderCourse();
    expect(screen.getByTestId('check-ssd')).toHaveTextContent(
      t('en', 'course.checked', { date: byId('ssd').checkedAt }),
    );
    for (const id of ['eun', 'mus', 'gwc']) {
      const el = screen.getByTestId(`check-${id}`);
      expect(el).toHaveTextContent(t('en', 'place.unverified'));
      expect(el.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
    // 한 곳이라도 확인 전이면 코스 전체도 확인일 대신 확인 전 표시
    expect(screen.getByTestId('course-unverified')).toHaveTextContent(t('en', 'place.unverified'));
  });

  it('주문 가능한 장소만 메뉴 수, 모든 장소에 문장 수', () => {
    renderCourse();
    const ssd = screen.getByTestId('stop-ssd');
    expect(ssd).toHaveTextContent(`${t('en', 'place.tabMenu')} ${byId('ssd').menu!.length}`);
    expect(screen.getByTestId('stop-eun')).not.toHaveTextContent(t('en', 'place.tabMenu'));
    expect(screen.getByTestId('stop-eun')).toHaveTextContent(String(byId('eun').phrases.length));
  });

  it('목록 클릭 → 장소 상세, 화면은 place_view를 직접 기록하지 않음', () => {
    renderCourse();
    fireEvent.click(screen.getByTestId('stop-mus'));
    expect(screen.getByTestId('probe')).toHaveTextContent('/place/mus');
    expect(useAppStore.getState().events).toEqual([]);
  });

  it('지도 핀 클릭 → 장소 상세', () => {
    renderCourse();
    fireEvent.click(screen.getByTestId('map-pin-gwc'));
    expect(screen.getByTestId('probe')).toHaveTextContent('/place/gwc');
  });

  it('오프라인이면 약도, 핀 이름은 "번호. 사용자 언어 장소명"', () => {
    renderCourse();
    expect(screen.getByTestId('map-sketch')).toBeInTheDocument();
    expect(screen.getByTestId('map-pin-ssd')).toHaveAttribute('aria-label', `1. ${byId('ssd').name.en}`);
  });

  it('Start walking: 기록이 없으면 1번 정류장 네이버 도보 길찾기 + Google 장소 보기', () => {
    renderCourse();
    const walk = screen.getByTestId('start-walking');
    expect(walk).toHaveTextContent(t('en', 'course.startWalk'));
    expect(walk).toHaveAttribute('href', naverWalkUrl(byId('ssd')));
    expect(walk).toHaveAttribute('target', '_blank');
    expect(walk.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText(t('en', 'course.dirNext', { n: 1 }))).toBeInTheDocument();
    const g = screen.getByTestId('google-maps');
    expect(g).toHaveAttribute('href', googlePlaceUrl(byId('ssd')));
    expect(g).toHaveTextContent(t('en', 'course.googleMaps', { n: 1 }));
  });

  it('Start walking: 2번을 본 뒤면 3번 정류장으로', () => {
    useAppStore.setState({ events: [{ type: 'place_view', placeId: 'eun', t: 1 }] });
    renderCourse();
    const walk = screen.getByTestId('start-walking');
    expect(walk).toHaveTextContent(t('en', 'course.walkToStop', { n: 3 }));
    expect(walk).toHaveAttribute('href', naverWalkUrl(byId('mus')));
    expect(screen.getByTestId('google-maps')).toHaveAttribute('href', googlePlaceUrl(byId('mus')));
  });

  it('언어 즉시 전환 (ja·zh)', () => {
    renderCourse();
    act(() => useAppStore.setState({ lang: 'ja' }));
    expect(screen.getByTestId('stop-ssd')).toHaveTextContent(byId('ssd').name.ja);
    expect(screen.getByTestId('start-walking')).toHaveTextContent(t('ja', 'course.startWalk'));
    act(() => useAppStore.setState({ lang: 'zh' }));
    expect(screen.getByTestId('check-eun')).toHaveTextContent(t('zh', 'place.unverified'));
    expect(screen.getByTestId('map-pin-ssd')).toHaveAttribute('aria-label', `1. ${byId('ssd').name.zh}`);
  });

  it('상단 문장 모음 버튼 → /phrases', () => {
    renderCourse();
    fireEvent.click(screen.getByRole('button', { name: t('en', 'nav.phrases') }));
    expect(screen.getByTestId('probe')).toHaveTextContent('/phrases');
  });

  it('누르는 요소는 공용 44px 클래스 또는 화면 CSS의 44px 규칙을 가짐', () => {
    renderCourse();
    expect(screen.getByTestId('start-walking')).toHaveClass('ui-btn');
    expect(screen.getByTestId('stop-ssd')).toHaveClass('course-stop');
    expect(screen.getByTestId('google-maps')).toHaveClass('course-actions__google');
  });
});

