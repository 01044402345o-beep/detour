/**
 * 외부 지도 링크 (T2.2, PRD F-03·F-04). 정확한 길찾기는 외부 지도에 맡깁니다.
 * - 기본: 네이버 지도 웹 도보 길찾기 (출발지는 비워 두고 네이버 지도가 현재 위치·출발지를 묻게 함)
 * - 보조: Google Maps 장소 보기 (Maps URLs 공식 형식 `api=1`)
 * 장소 상세(T2.3)도 이 모듈을 import해 같은 URL을 씁니다. Leaflet을 끌어오지 않도록 지도 컴포넌트와 분리했습니다.
 */
import type { GeoPoint } from '../../types';

export type ExternalMapTarget = { nameKo: string; geo: GeoPoint };

/** 좌표를 소수 6자리로 (약 0.1m) */
function coord(n: number): string {
  return String(Number(n.toFixed(6)));
}

/**
 * 네이버 지도 웹 도보 길찾기 URL.
 * 형식: `https://map.naver.com/p/directions/{출발}/{도착}/{경유}/walk`, 각 지점은 `경도,위도,이름,,`.
 * 출발·경유는 `-`(미지정).
 */
export function naverWalkUrl(target: ExternalMapTarget): string {
  const { lat, lng } = target.geo;
  const goal = `${coord(lng)},${coord(lat)},${encodeURIComponent(target.nameKo)},,`;
  return `https://map.naver.com/p/directions/-/${goal}/-/walk`;
}

/** Google Maps 장소 보기 URL (좌표 검색). 한국에서는 Google 도보 길찾기가 제한되므로 장소 보기만 씁니다. */
export function googlePlaceUrl(target: ExternalMapTarget): string {
  const { lat, lng } = target.geo;
  return `https://www.google.com/maps/search/?api=1&query=${coord(lat)}%2C${coord(lng)}`;
}
