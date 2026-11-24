/**
 * SVG 약도 (목업 S02 .mapbox). 타일 실패·오프라인일 때 쓰며 네트워크가 필요 없습니다.
 * 정류장 위치는 실제 좌표(downtown.json geo)를 약도 상자에 투영합니다. 배경 블록·도로·하천은 장식입니다.
 */
import type { KeyboardEvent } from 'react';
import { useT } from '../../i18n';
import { projectToBox } from './projection';
import { PIN_FILL, PIN_HIT_R, SKETCH_BG, SKETCH_H, SKETCH_TEXT, SKETCH_W } from './sketchConstants';
import type { GeoPoint } from '../../types';
import type { MapStop } from './types';

const BLOCKS: readonly [number, number, number, number][] = [
  [18, 20, 70, 60],
  [100, 18, 80, 40],
  [18, 196, 60, 70],
  [160, 210, 90, 62],
  [150, 40, 40, 38],
  [196, 236, 40, 36],
];

export type SketchMapProps = {
  stops: readonly MapStop[];
  onSelect: (id: string) => void;
  /** 그림 전체의 이름 (예: 코스 제목) */
  label: string;
  /** 도보 경로 좌표 (CourseMap 참고). 없으면 정류장을 직선 점선으로 잇습니다 */
  route?: readonly GeoPoint[];
};

export function SketchMap({ stops, onSelect, label, route }: SketchMapProps) {
  const t = useT();
  const hasRoute = !!route && route.length >= 2;
  // 정류장과 경로를 같은 축척으로 투영해야 핀이 경로 위에 놓입니다
  const all = projectToBox([...stops.map((s) => s.geo), ...(hasRoute ? route : [])], {
    width: SKETCH_W - 50,
    height: SKETCH_H,
    padding: 40,
  });
  const xy = all.slice(0, stops.length);
  const linePts = hasRoute ? all.slice(stops.length) : xy;
  const line = linePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const onKey = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };
  return (
    <svg
      className="cmap-sketch"
      viewBox={`0 0 ${SKETCH_W} ${SKETCH_H}`}
      role="group"
      aria-label={label}
      data-testid="map-sketch"
    >
      <rect width={SKETCH_W} height={SKETCH_H} fill={SKETCH_BG.ground} />
      {BLOCKS.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={8} fill={SKETCH_BG.block} />
      ))}
      <path
        d="M318 0 C300 80 330 150 304 290"
        stroke={SKETCH_BG.stream}
        strokeWidth={16}
        fill="none"
        strokeLinecap="round"
      />
      <text
        x={323}
        y={270}
        fontSize={9}
        fill={SKETCH_TEXT.stream.fill}
        fontWeight={700}
        transform="rotate(-80 323 270)"
      >
        {t('course.mapStream')}
      </text>
      <path d="M0 170 H360" stroke={SKETCH_BG.road} strokeWidth={18} />
      <path d="M250 0 V290" stroke={SKETCH_BG.road} strokeWidth={12} />
      <path d="M150 100 V290" stroke={SKETCH_BG.road} strokeWidth={8} />
      <path d="M0 110 H250" stroke={SKETCH_BG.road} strokeWidth={7} />
      <text
        x={352}
        y={160}
        fontSize={9}
        textAnchor="end"
        fill={SKETCH_TEXT.toStation.fill}
        fontWeight={700}
      >
        {t('course.mapToDaejeonStn')}
      </text>
      <path
        d={line}
        fill="none"
        stroke="#151a26"
        strokeWidth={hasRoute ? 3.5 : 3}
        strokeDasharray={hasRoute ? undefined : '7 6'}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={hasRoute ? 0.7 : 0.75}
        data-route={hasRoute ? 'walk' : 'straight'}
        data-testid="map-line"
      />
      {stops.map((s, i) => (
        <g
          key={s.id}
          className="cmap-sketch__pin"
          role="button"
          tabIndex={0}
          aria-label={`${s.no}. ${s.name}`}
          data-testid={`map-pin-${s.id}`}
          onClick={() => onSelect(s.id)}
          onKeyDown={onKey(s.id)}
        >
          {/* 터치 영역: 최소 폭 360px에서도 지름 44px 이상 */}
          <circle cx={xy[i].x} cy={xy[i].y} r={PIN_HIT_R} fill="transparent" />
          <circle
            className="cmap-sketch__dot"
            cx={xy[i].x}
            cy={xy[i].y}
            r={15}
            fill={PIN_FILL[s.category]}
            stroke="#fff"
            strokeWidth={3.5}
          />
          <text
            x={xy[i].x}
            y={xy[i].y + 5}
            fontSize={14}
            fontWeight={800}
            fill={SKETCH_TEXT.pin.fill}
            textAnchor="middle"
            aria-hidden="true"
          >
            {s.no}
          </text>
        </g>
      ))}
    </svg>
  );
}
