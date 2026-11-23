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
