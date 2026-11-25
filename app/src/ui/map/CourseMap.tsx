/**
 * 코스 지도 (T2.2, PRD F-03). OSM 타일 지도를 먼저 쓰고,
 * 오프라인이거나 타일이 실패하면 SVG 약도로 자동 전환합니다(PRD 8장). 한 번 약도로 바뀌면 화면을 떠날 때까지 유지합니다.
 */
import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { LeafletMap } from './LeafletMap';
import { OSM_COPYRIGHT_URL, OSM_CREDIT } from './osm';
import { SketchMap } from './SketchMap';
import type { GeoPoint } from '../../types';
import type { MapLeg, MapMode, MapStart, MapStop } from './types';

export type CourseMapProps = {
  /** 방문 순서대로. 바뀔 때마다 지도를 다시 그리므로 useMemo로 넘기세요 */
  stops: readonly MapStop[];
  onSelect: (id: string) => void;
  label: string;
  /** 정류장 사이 도보 경로 (1번→마지막, 한 줄로 이은 좌표). 없으면 정류장을 직선 점선으로 잇습니다 */
  route?: readonly GeoPoint[];
  /** 출발지 이름표 (예: 대전역). route가 있으면 route 첫 점과 같은 위치여야 합니다 */
  start?: MapStart;
  /** 도보 구간별 경로·분 (지도 위 구간 분 칩, T6.3). route가 있을 때만 그립니다 */
  legs?: readonly MapLeg[];
};

function initialMode(): MapMode {
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'sketch' : 'tiles';
}

export function CourseMap({ stops, onSelect, label, route, start, legs }: CourseMapProps) {
  const t = useT();
  const [mode, setMode] = useState<MapMode>(initialMode);

  useEffect(() => {
    const toSketch = () => setMode('sketch');
    window.addEventListener('offline', toSketch);
    return () => window.removeEventListener('offline', toSketch);
  }, []);

  return (
    <div className="cmap" data-mode={mode}>
      <div className="cmap-box">
        {mode === 'tiles' ? (
          <LeafletMap
            stops={stops}
            onSelect={onSelect}
            onFail={() => setMode('sketch')}
            label={label}
            route={route}
            start={start}
            legs={legs}
          />
        ) : (
          <SketchMap
            stops={stops}
            onSelect={onSelect}
            label={label}
            route={route}
            start={start}
            legs={legs}
          />
        )}
      </div>
      <p className="cmap-note">{t(route ? 'course.routeNote' : 'course.lineNote')}</p>
      {mode === 'sketch' && (
        <p className="cmap-note cmap-note--offline" role="status">
          {t('course.mapOffline')}
        </p>
      )}
      {/* 약도는 OSM 타일이 없어도 OSM 기반 경로를 그리므로 출처를 따로 표시합니다 (R1 M-3, PRD 8장 OSM 출처 상시) */}
      {mode === 'sketch' && route && (
        <p className="cmap-note cmap-src" data-testid="map-route-source">
          {t('course.routeSource')}{' '}
          <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer">
            {OSM_CREDIT}
          </a>
        </p>
      )}
    </div>
  );
}
