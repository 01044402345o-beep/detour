import type { Place } from '../types';
import { bundleOfPlace, bundles, content, course, getBundle, getPlace, places } from './index';

describe('data 진입점', () => {
  it('코스별 장소는 order 순서이고 course.stops와 같음, 전체 places = 코스 순서대로 이어 붙임', () => {
    for (const b of bundles) expect(b.places.map((p) => p.id)).toEqual(b.course.stops);
    expect(places.map((p) => p.id)).toEqual(bundles.flatMap((b) => b.course.stops));
    expect(content.hub).toBe('downtown');
    expect(course.id).toBe('downtown-halfday');
  });

  it('코스 2개: 원도심(downtown) + 대전역·소제동 거점의 전통시장(station, market) (T5.1)', () => {
    expect(bundles.map((b) => [b.course.id, b.course.hub, b.course.theme ?? 'walk'])).toEqual([
      ['downtown-halfday', 'downtown', 'walk'],
      ['jungang-market', 'station', 'market'],
    ]);
    const m = getBundle('jungang-market')!;
    expect(m.places.map((p) => p.nameKo)).toEqual(['수연분식', '개천식당', '생일집', '홍가네풀빵']);
    expect(m.places.every((p) => p.verified === false)).toBe(true);
    expect(m.course.start.nameKo).toBe('대전역');
    expect(m.course.events?.map((e) => [e.id, e.startDate, e.endDate, e.days, e.hours])).toEqual([
      ['totojeul-2026', '2026-08-14', '2026-11-28', 'fri,sat', '18:00–22:00'],
    ]);
    expect(m.route.legs.map((l) => `${l.from}>${l.to}`)).toEqual([
      'djs>sy',
      'sy>gc',
      'gc>sj',
      'sj>hg',
    ]);
    expect(bundleOfPlace('sj')?.course.id).toBe('jungang-market');
    expect(bundleOfPlace('ssd')?.course.id).toBe('downtown-halfday');
  });

  it('getPlace: id로 찾고, 없으면 undefined', () => {
    expect(getPlace('gwc')?.nameKo).toBe('광천식당');
    expect(getPlace('nope')).toBeUndefined();
  });

  it('ContentPlace는 공유 계약 Place로 쓸 수 있음', () => {
    const asPlace: Place[] = places;
    expect(asPlace).toHaveLength(8);
  });
});
