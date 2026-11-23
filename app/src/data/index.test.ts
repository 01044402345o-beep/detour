import type { Place } from '../types';
import { content, course, getPlace, places } from './index';

describe('data 진입점', () => {
  it('장소는 order 순서이고 course.stops와 같음', () => {
    expect(places.map((p) => p.id)).toEqual(course.stops);
    expect(content.hub).toBe('downtown');
  });

  it('getPlace: id로 찾고, 없으면 undefined', () => {
    expect(getPlace('gwc')?.nameKo).toBe('광천식당');
    expect(getPlace('nope')).toBeUndefined();
  });

  it('ContentPlace는 공유 계약 Place로 쓸 수 있음', () => {
    const asPlace: Place[] = places;
    expect(asPlace).toHaveLength(4);
  });
});
