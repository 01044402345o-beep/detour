import type { GeoPoint, PlaceCategory } from '../../types';

/** 지도에 그리는 정류장 하나 (방문 순서대로 넘김) */
export type MapStop = {
  id: string;
  /** 표시 번호 (1부터) */
  no: number;
  /** 화면 낭독기 이름 (사용자 언어 장소명) */
  name: string;
  category: PlaceCategory;
  geo: GeoPoint;
};

/** 출발지 표시 (번호 없는 이름표. 누를 수 없음) */
export type MapStart = {
  /** 화면에 보이는 이름 (사용자 언어, 예: Daejeon Stn) */
  label: string;
  geo: GeoPoint;
};

/** 지도 표시 방식: OSM 타일 지도 / SVG 약도 */
export type MapMode = 'tiles' | 'sketch';

/** 도보 구간 하나 (출발지→1번, 1번→2번 …). 지도 위 구간 분 칩에 씀 (T6.3) */
export type MapLeg = {
  /** 구간 경로 좌표 (구간 시작 → 끝) */
  path: readonly GeoPoint[];
  /** 칩 글자 (사용자 언어, 예: "11 min") */
  label: string;
};
