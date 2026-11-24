import { act, fireEvent, render, screen } from '@testing-library/react';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { CourseMap } from './CourseMap';
import type { MapStop } from './types';

// 타일 지도는 가짜로 바꿔 실패 신호만 흉내 냅니다 (실제 Leaflet 동작은 LeafletMap.test.tsx).
vi.mock('./LeafletMap', () => ({
  LeafletMap: (p: { onFail: () => void; onSelect: (id: string) => void }) => (
    <div data-testid="map-tiles">
      <button type="button" onClick={p.onFail}>
        fail
      </button>
      <button type="button" onClick={() => p.onSelect('ssd')}>
        pick
      </button>
    </div>
  ),
}));

describe('선 안내 문구 (T2.2b)', () => {
  it('도보 경로가 있으면 경로 안내, 없으면 직선 안내', () => {
    const route = [
      { lat: 36.3277, lng: 127.4273 },
      { lat: 36.3289, lng: 127.4262 },
    ];
    const { unmount } = render(
      <CourseMap stops={STOPS} onSelect={() => {}} label="x" route={route} />,
    );
    expect(screen.getByText(t('en', 'course.routeNote'))).toBeInTheDocument();
    expect(screen.queryByText(t('en', 'course.lineNote'))).toBeNull();
    unmount();
    render(<CourseMap stops={STOPS} onSelect={() => {}} label="x" />);
    expect(screen.getByText(t('en', 'course.lineNote'))).toBeInTheDocument();
  });
});

const STOPS: MapStop[] = [
  { id: 'ssd', no: 1, name: 'Sungsimdang', category: 'food', geo: { lat: 36.3277, lng: 127.4273 } },
  {
    id: 'eun',
    no: 2,
    name: 'Euneungjeongi',
    category: 'sight',
    geo: { lat: 36.3289, lng: 127.4262 },
  },
];

let onLine = true;
beforeAll(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => onLine);
});
beforeEach(() => {
  onLine = true;
  useAppStore.setState({ lang: 'en' });
});
afterEach(() => useAppStore.setState({ lang: null }));

describe('CourseMap 전환', () => {
  it('온라인이면 타일 지도 + 연결선 안내(보행 경로 아님)', () => {
    render(<CourseMap stops={STOPS} onSelect={() => {}} label="Course" />);
    expect(screen.getByTestId('map-tiles')).toBeInTheDocument();
    expect(screen.queryByTestId('map-sketch')).toBeNull();
    expect(screen.getByText(t('en', 'course.lineNote'))).toBeInTheDocument();
    expect(screen.queryByText(t('en', 'course.mapOffline'))).toBeNull();
  });

  it('처음부터 오프라인이면 바로 약도 + 전환 안내', () => {
    onLine = false;
    render(<CourseMap stops={STOPS} onSelect={() => {}} label="Course" />);
    expect(screen.queryByTestId('map-tiles')).toBeNull();
    expect(screen.getByTestId('map-sketch')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(t('en', 'course.mapOffline'));
    expect(screen.getByText(t('en', 'course.lineNote'))).toBeInTheDocument();
  });

  it('타일 실패 → 약도로 자동 전환', () => {
    render(<CourseMap stops={STOPS} onSelect={() => {}} label="Course" />);
    fireEvent.click(screen.getByText('fail'));
    expect(screen.getByTestId('map-sketch')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(t('en', 'course.mapOffline'));
  });

  it('보는 중 오프라인이 되면 약도로 전환하고, 다시 온라인이 돼도 약도 유지', () => {
    render(<CourseMap stops={STOPS} onSelect={() => {}} label="Course" />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('map-sketch')).toBeInTheDocument();
    onLine = true;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('map-sketch')).toBeInTheDocument();
  });

  it('두 방식 모두 핀 선택을 onSelect로 넘김', () => {
    const onSelect = vi.fn();
    render(<CourseMap stops={STOPS} onSelect={onSelect} label="Course" />);
    fireEvent.click(screen.getByText('pick'));
    fireEvent.click(screen.getByText('fail'));
    fireEvent.click(screen.getByTestId('map-pin-eun'));
    expect(onSelect.mock.calls).toEqual([['ssd'], ['eun']]);
  });
});
