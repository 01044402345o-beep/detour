import { places } from '../../data';
import { googlePlaceUrl, naverWalkUrl } from './externalMap';

const ssd = places.find((p) => p.id === 'ssd')!;

describe('externalMap', () => {
  it('네이버 지도 웹 도보 길찾기: 도착지만 지정(경도,위도,한국어 이름), walk 모드', () => {
    const url = naverWalkUrl(ssd);
    expect(url).toBe(
      `https://map.naver.com/p/directions/-/127.4273,36.3277,${encodeURIComponent('성심당 본점')},,/-/walk`,
    );
    expect(new URL(url).hostname).toBe('map.naver.com');
  });

  it('Google Maps 장소 보기: api=1 좌표 검색', () => {
    const url = new URL(googlePlaceUrl(ssd));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('36.3277,127.4273');
  });

  it('좌표는 소수 6자리로 자르고, 이름의 특수문자는 인코딩', () => {
    const url = naverWalkUrl({ nameKo: 'A/B 가게', geo: { lat: 36.12345678, lng: 127.98765432 } });
    expect(url).toContain('127.987654,36.123457,A%2FB%20%EA%B0%80%EA%B2%8C,,');
  });

  it('모든 코스 장소에 대해 URL을 만들 수 있음', () => {
    for (const p of places) {
      expect(naverWalkUrl(p)).toMatch(/^https:\/\/map\.naver\.com\/p\/directions\/-\/.+\/-\/walk$/);
      expect(googlePlaceUrl(p)).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1/);
    }
  });
});
