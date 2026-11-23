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

/** 지도 표시 방식: OSM 타일 지도 / SVG 약도 */
export type MapMode = 'tiles' | 'sketch';
