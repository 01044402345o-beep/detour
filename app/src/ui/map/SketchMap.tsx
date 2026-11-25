/**
 * SVG 약도 (목업 S02 .mapbox). 타일 실패·오프라인일 때 쓰며 네트워크가 필요 없습니다.
 * 정류장 위치는 실제 좌표(downtown.json geo)를 약도 상자에 투영합니다. 배경 블록·도로·하천은 장식입니다.
 */
import type { KeyboardEvent } from 'react';
import { useT } from '../../i18n';
import { chipSize, placeChips, rectAround, textWidth, type Rect } from './chips';
import { projectToBox, separate } from './projection';
import {
  CHIP_FILL,
  CHIP_STROKE,
  CHIP_FONT,
  PIN_FILL,
  PIN_HIT_R,
  PIN_STROKE,
  ROUTE_CASING,
  ROUTE_COLOR,
  SKETCH_BG,
  SKETCH_H,
  SKETCH_TEXT,
  SKETCH_W,
  START_DOT,
  START_FILL,
} from './sketchConstants';
import type { GeoPoint } from '../../types';
import type { MapLeg, MapStart, MapStop } from './types';

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
  /** 출발지 이름표. 있으면 장식 문구 "대전역 방향 →" 대신 실제 위치에 이름표를 그립니다 */
  start?: MapStart;
  /** 도보 구간 (구간 분 칩). route가 있을 때만 그립니다 */
  legs?: readonly MapLeg[];
};

/** 보이는 핀 원 반지름·테두리 (viewBox 단위) */
const PIN_R = 14;
const PIN_SW = 3;
/** 출발 표시(둥근 네모) 크기 */
const START_W = 24;
const START_H = 18;

/** 이름표 글자 크기·여백 (viewBox 단위) */
const TAG_FONT = 11;
const TAG_PAD_X = 8;
const TAG_H = 22;

export function SketchMap({ stops, onSelect, label, route, start, legs }: SketchMapProps) {
  const t = useT();
  const hasRoute = !!route && route.length >= 2;
  // 정류장과 경로를 같은 축척으로 투영해야 핀이 경로 위에 놓입니다
  const legList = hasRoute && legs ? legs : [];
  const legGeo = legList.flatMap((l) => l.path);
  const all = projectToBox(
    [
      ...stops.map((s) => s.geo),
      ...(start ? [start.geo] : []),
      ...(hasRoute ? route : []),
      ...legGeo,
    ],
    {
      width: SKETCH_W - 50,
      height: SKETCH_H,
      padding: 40,
    },
  );
  // 정류장이 가까우면(시장 등) 핀 터치 영역(지름 PIN_HIT_R×2)이 겹치지 않게 벌립니다.
  // 벌어진 핀은 경로 끝점에서 몇 px 떨어질 수 있지만 핀 원(반지름 14 + 테두리)이 이음매를 덮습니다.
  const xy = separate(all.slice(0, stops.length), PIN_HIT_R * 2 + 1, {
    box: { width: SKETCH_W, height: SKETCH_H, margin: PIN_HIT_R },
  });
  const startXY = start ? all[stops.length] : null;
  const routeAt = stops.length + (start ? 1 : 0);
  const linePts = hasRoute ? all.slice(routeAt, routeAt + route.length) : xy;
  // 이름표: 출발 지점 위쪽 가운데, 상자 밖으로 나가지 않게
  const tagW = start ? Math.round(textWidth(start.label, TAG_FONT) + TAG_PAD_X * 2) : 0;
  const tagX = startXY ? Math.min(Math.max(startXY.x - tagW / 2, 4), SKETCH_W - tagW - 4) : 0;
  const tagY = startXY ? Math.max(startXY.y - TAG_H - 10, 4) : 0;
  // 구간 분 칩: 핀·출발 표시·이름표와 겹치지 않는 자리에만 (없으면 숨김, 분은 목록에 있음)
  const obstacles: Rect[] = [
    ...xy.map((p) => rectAround(p, (PIN_R + PIN_SW) * 2, (PIN_R + PIN_SW) * 2)),
    ...(startXY
      ? [rectAround(startXY, START_W + 4, START_H + 4), { x: tagX, y: tagY, w: tagW, h: TAG_H }]
      : []),
  ];
  const legsAt = routeAt + (hasRoute ? route.length : 0);
  const legStarts = legList.map((_, i) =>
    legList.slice(0, i).reduce((a, l) => a + l.path.length, legsAt),
  );
  const chipLegs = legList.map((l, i) => ({
    path: all.slice(legStarts[i], legStarts[i] + l.path.length),
    ...chipSize(l.label, CHIP_FONT),
  }));
  const chipAt = placeChips(chipLegs, obstacles, {
    width: SKETCH_W,
    height: SKETCH_H,
    margin: 2,
  });
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
      {/* 장식 하천은 약도 오른쪽 고정 위치라, 실제 대전역(하천 동쪽)을 그릴 때는 위치가 틀리므로 숨깁니다 */}
      {!start && (
        <>
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
            fontWeight={600}
            transform="rotate(-80 323 270)"
          >
            {t('course.mapStream')}
          </text>
        </>
      )}
      <path d="M0 170 H360" stroke={SKETCH_BG.road} strokeWidth={18} />
      <path d="M250 0 V290" stroke={SKETCH_BG.road} strokeWidth={12} />
      <path d="M150 100 V290" stroke={SKETCH_BG.road} strokeWidth={8} />
      <path d="M0 110 H250" stroke={SKETCH_BG.road} strokeWidth={7} />
      {!start && (
        <text
          x={352}
          y={160}
          fontSize={9}
          textAnchor="end"
          fill={SKETCH_TEXT.toStation.fill}
          fontWeight={600}
        >
          {t('course.mapToDaejeonStn')}
        </text>
      )}
      {/* 경로선: 아래 굵은 흰 선(테두리) + 위 파란 선 */}
      <path
        className="cmap-sketch__casing"
        d={line}
        fill="none"
        stroke={ROUTE_CASING}
        strokeWidth={hasRoute ? 8 : 7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      />
      <path
        d={line}
        fill="none"
        stroke={ROUTE_COLOR}
        strokeWidth={hasRoute ? 4 : 3}
        strokeDasharray={hasRoute ? undefined : '7 6'}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-route={hasRoute ? 'walk' : 'straight'}
        data-testid="map-line"
      />
      {chipLegs.map((l, i) => {
        const c = chipAt[i];
        if (!c) return null;
        return (
          <g key={i} className="cmap-sketch__chip" aria-hidden="true" data-testid={`map-chip-${i}`}>
            <rect
              x={c.x - l.w / 2}
              y={c.y - l.h / 2}
              width={l.w}
              height={l.h}
              rx={4}
              fill={CHIP_FILL}
              stroke={CHIP_STROKE}
              strokeWidth={1}
            />
            <text
              className="cmap-sketch__num"
              x={c.x}
              y={c.y + CHIP_FONT * 0.36}
              fontSize={CHIP_FONT}
              fontWeight={600}
              fill={SKETCH_TEXT.chip.fill}
              textAnchor="middle"
            >
              {legList[i].label}
            </text>
          </g>
        );
      })}
      {start && startXY && (
        <g data-testid="map-start">
          {/* 이름표 (흰 바탕 + 본문 글자) */}
          <rect
            x={tagX}
            y={tagY}
            width={tagW}
            height={TAG_H}
            rx={6}
            fill={START_FILL}
            stroke={SKETCH_BG.block}
            strokeWidth={1}
          />
          {/* 출발 표시: 흰 둥근 네모 + 파란 테두리 + 가운데 작은 점 (점 가운데 = 정확한 위치) */}
          <rect
            x={startXY.x - START_W / 2}
            y={startXY.y - START_H / 2}
            width={START_W}
            height={START_H}
            rx={6}
            fill={START_FILL}
            stroke={PIN_STROKE}
            strokeWidth={PIN_SW}
          />
          <circle cx={startXY.x} cy={startXY.y} r={3.5} fill={START_DOT} />
          <text
            x={tagX + tagW / 2}
            y={tagY + TAG_H / 2 + TAG_FONT * 0.36}
            fontSize={TAG_FONT}
            fontWeight={600}
            fill={SKETCH_TEXT.start.fill}
            textAnchor="middle"
          >
            {start.label}
          </text>
        </g>
      )}
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
            r={PIN_R}
            fill={PIN_FILL[s.category]}
            stroke={PIN_STROKE}
            strokeWidth={PIN_SW}
          />
          <text
            className="cmap-sketch__num"
            x={xy[i].x}
            y={xy[i].y + 4.6}
            fontSize={13}
            fontWeight={600}
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
