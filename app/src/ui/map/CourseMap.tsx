/**
 * 코스 지도 (T2.2, PRD F-03). OSM 타일 지도를 먼저 쓰고,
 * 오프라인이거나 타일이 실패하면 SVG 약도로 자동 전환합니다(PRD 8장). 한 번 약도로 바뀌면 화면을 떠날 때까지 유지합니다.
 */
import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { LeafletMap } from './LeafletMap';
import { SketchMap } from './SketchMap';
import type { MapMode, MapStop } from './types';

export type CourseMapProps = {
  /** 방문 순서대로. 바뀔 때마다 지도를 다시 그리므로 useMemo로 넘기세요 */
  stops: readonly MapStop[];
  onSelect: (id: string) => void;
  label: string;
};

function initialMode(): MapMode {
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'sketch' : 'tiles';
}

export function CourseMap({ stops, onSelect, label }: CourseMapProps) {
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
          />
        ) : (
          <SketchMap stops={stops} onSelect={onSelect} label={label} />
        )}
      </div>
      <p className="cmap-note">{t('course.lineNote')}</p>
      {mode === 'sketch' && (
        <p className="cmap-note cmap-note--offline" role="status">
          {t('course.mapOffline')}
        </p>
      )}
    </div>
  );
}
