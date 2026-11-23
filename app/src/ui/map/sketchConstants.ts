/** SVG 약도 크기·터치 영역 상수 (T2.2) */
export const SKETCH_W = 360;
export const SKETCH_H = 290;

/** 지원하는 최소 화면 폭 (PRD 7장·E2E 360×780) */
export const MIN_VIEWPORT_W = 360;
/** 약도가 화면 폭보다 좁아지는 만큼: .cmap 좌우 여백 16px×2 + .cmap-box 테두리 1px×2 */
export const MAP_INSET_PX = 34;
/** 최소 터치 영역 (px) */
export const TOUCH_PX = 44;
/**
 * 핀 투명 히트 원 반지름(viewBox 단위). 약도는 viewBox 360을 (화면 폭 − 34)px로 줄여 그리므로,
 * 최소 폭 360px에서도 지름이 44px 이상이 되게 계산합니다(= 25, R1 M-02).
 */
export const PIN_HIT_R = Math.ceil(((TOUCH_PX / 2) * SKETCH_W) / (MIN_VIEWPORT_W - MAP_INSET_PX));

/** 약도 바탕 색 (글자 뒤에 올 수 있는 면) */
export const SKETCH_BG = {
  ground: '#f1ebde',
  block: '#e8e0cf',
  stream: '#bcd9e6',
  road: '#fff',
} as const;

/**
 * 약도 글자 색과 그 글자가 놓일 수 있는 바탕 (T3.2 대비 4.5:1, SketchMap.test가 모든 쌍을 계산).
 * 새 글자를 넣으면 이 표에 등록해야 테스트가 통과합니다.
 * - 하천 이름: 회전된 글자가 하천·바탕·블록·도로에 걸칠 수 있음. #4f7385(최저 3.45) → --sea-d #0c5654(최저 5.74)
 * - 대전역 방향: 하천 옆 바탕·도로 위
 * - 핀 번호: 흰 글자, 핀 채움(음식 --acc-d, 볼거리 --plum)
 */
export const SKETCH_TEXT = {
  stream: { fill: '#0c5654', on: Object.values(SKETCH_BG) },
  toStation: { fill: '#0c5654', on: Object.values(SKETCH_BG) },
  pin: { fill: '#fff', on: ['var(--acc-d)', 'var(--plum)'] },
} as const;

/** 핀 채움 (흰 번호 글자 대비 4.5:1) */
export const PIN_FILL = { food: 'var(--acc-d)', sight: 'var(--plum)' } as const;
