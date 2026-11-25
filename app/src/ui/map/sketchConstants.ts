/** SVG 약도 크기·터치 영역 상수 (T2.2) */
export const SKETCH_W = 360;
export const SKETCH_H = 290;

/** 지원하는 최소 화면 폭 (PRD 7장·E2E 360×780) */
export const MIN_VIEWPORT_W = 360;
/** 약도가 화면 폭보다 좁아지는 만큼: .cmap 좌우 여백 16px×2 + .cmap-box 테두리 1px×2 */
export const MAP_INSET_PX = 34;
/** 최소 글자 크기 (px, DESIGN.md 3장 — 사진 출처 등 가장 작은 글자) */
export const MIN_TEXT_PX = 11.5;
/**
 * 약도 분 칩 글자 크기 (viewBox 단위). 약도는 viewBox 360을 (화면 폭 − MAP_INSET_PX)px로 줄여 그리므로
 * 최소 폭 360px에서도 실제 글자가 MIN_TEXT_PX 이상이 되게 계산합니다 (R1 L-1) → 13.
 */
export const CHIP_FONT = Math.ceil((MIN_TEXT_PX * SKETCH_W) / (MIN_VIEWPORT_W - MAP_INSET_PX));
/** 최소 터치 영역 (px) */
export const TOUCH_PX = 44;
/**
 * 핀 투명 히트 원 반지름(viewBox 단위). 약도는 viewBox 360을 (화면 폭 − 34)px로 줄여 그리므로,
 * 최소 폭 360px에서도 지름이 44px 이상이 되게 계산합니다(= 25, R1 M-02).
 */
export const PIN_HIT_R = Math.ceil(((TOUCH_PX / 2) * SKETCH_W) / (MIN_VIEWPORT_W - MAP_INSET_PX));

/**
 * 약도 색 (T6.3, DESIGN.md 2장·7장 '코스': 오프라인 약도도 타일 지도와 같은 색 체계).
 * 밝은 회청색 바탕 + 흰 도로, 파란 경로선(흰 테두리), 흰 핀(파란 테두리·파란 번호), 연파랑 분 칩.
 */
export const SKETCH_BG = {
  ground: '#eef2f7',
  block: '#e2e8f0',
  stream: '#cddcf3',
  road: '#ffffff',
} as const;

/** 경로선 (--blue)과 그 아래 흰 테두리 */
export const ROUTE_COLOR = '#1d5bd6';
export const ROUTE_CASING = '#ffffff';
/** 핀: 흰 바탕 + 파란 테두리 */
export const PIN_STROKE = '#1d5bd6';
/** 출발 표시 안 작은 점 (--signal, 단독으로 뜻을 전하지 않음: 이름표와 함께) */
export const START_DOT = '#ffb21a';
/** 구간 분 칩: --tint 바탕, 옅은 파란 테두리 */
export const CHIP_FILL = '#e6eefb';
export const CHIP_STROKE = '#b9ccf2';

/**
 * 약도 글자 색과 그 글자가 놓일 수 있는 바탕 (T3.2 대비 4.5:1, SketchMap.test가 모든 쌍을 계산).
 * 새 글자를 넣으면 이 표에 등록해야 테스트가 통과합니다.
 * - 하천 이름: 회전된 글자가 하천·바탕·블록·도로에 걸칠 수 있음 → --blue-deep
 * - 대전역 방향: 하천 옆 바탕·도로 위 → --blue-deep
 * - 핀 번호: 파란 글자(--blue), 흰 핀 채움 위
 * - 출발지 이름표: 본문 글자(--ink), 흰 이름표 위
 * - 구간 분 칩: 파란 글자, --tint 칩 위
 */
export const SKETCH_TEXT = {
  stream: { fill: '#0e3a8f', on: Object.values(SKETCH_BG) },
  toStation: { fill: '#0e3a8f', on: Object.values(SKETCH_BG) },
  pin: { fill: '#1d5bd6', on: ['#ffffff'] },
  /** 출발지 이름표 (대전역): 이름표 채움 START_FILL */
  start: { fill: '#0f1b33', on: ['#ffffff'] },
  chip: { fill: '#1d5bd6', on: [CHIP_FILL] },
} as const;

/** 출발지 이름표 채움 (SKETCH_TEXT.start 바탕과 같음) */
export const START_FILL = '#ffffff';

/** 핀 채움 (파란 번호 글자 대비 4.5:1). 종류와 관계없이 흰 핀 (DESIGN.md 7장) */
export const PIN_FILL = { food: '#ffffff', sight: '#ffffff' } as const;
