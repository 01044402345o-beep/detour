/**
 * 외부 지도 링크 (T2.2, PRD F-03·F-04). 정확한 길찾기는 외부 지도에 맡깁니다.
 * - 기본: 네이버 지도 웹 도보 길찾기
 *   ⚠ 시연 영상 녹화용 임시 상태(2026-11-26): 출발지를 **대전역으로 고정**합니다.
 *   녹화가 끝나면 태그 `pre-demo-start`(출발지 비움, 네이버가 현재 위치·출발지를 묻게 함)로 되돌립니다.
 * - 보조: Google Maps 장소 보기 (Maps URLs 공식 형식 `api=1`)
 * 장소 상세(T2.3)도 이 모듈을 import해 같은 URL을 씁니다. Leaflet을 끌어오지 않도록 지도 컴포넌트와 분리했습니다.
 */
import { courses } from '../../data';
import type { GeoPoint } from '../../types';

export type ExternalMapTarget = { nameKo: string; geo: GeoPoint };

/** 좌표를 소수 6자리로 (약 0.1m) */
function coord(n: number): string {
  return String(Number(n.toFixed(6)));
}

/** 녹화용 고정 출발지: 코스 데이터의 출발지(대전역). 모든 코스가 같은 출발지인지 externalMap.test.ts가 확인 */
export const DEMO_START: ExternalMapTarget = courses[0].start;

/** 지점 → `경도,위도,이름,,` */
function point(t: ExternalMapTarget): string {
  return `${coord(t.geo.lng)},${coord(t.geo.lat)},${encodeURIComponent(t.nameKo)},,`;
}

/**
 * 네이버 지도 웹 도보 길찾기 URL.
 * 형식: `https://map.naver.com/p/directions/{출발}/{도착}/{경유}/walk`, 각 지점은 `경도,위도,이름,,`.
 * 출발은 대전역(녹화용 임시), 경유는 `-`(미지정).
 * 휴대폰 브라우저에서는 네이버 '빠른길찾기'로 열리며 대전역→도착지 도보 경로와 '지도앱으로 보기'가 나옵니다.
 */
export function naverWalkUrl(target: ExternalMapTarget): string {
  return `https://map.naver.com/p/directions/${point(DEMO_START)}/${point(target)}/-/walk`;
}

/** Google Maps 장소 보기 URL (좌표 검색). 한국에서는 Google 도보 길찾기가 제한되므로 장소 보기만 씁니다. */
export function googlePlaceUrl(target: ExternalMapTarget): string {
  const { lat, lng } = target.geo;
  return `https://www.google.com/maps/search/?api=1&query=${coord(lat)}%2C${coord(lng)}`;
}
