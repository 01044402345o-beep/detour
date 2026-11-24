import { describe, expect, it } from 'vitest';
import raw from './courseRoute.json';
import { course, courseRoute, places } from './index';
import { parseCourseRoute } from './route';

const stops = course.stops.map((id) => {
  const p = places.find((q) => q.id === id)!;
  return { id: p.id, geo: p.geo };
});
const clone = () => JSON.parse(JSON.stringify(raw)) as typeof raw;

describe('코스 도보 경로 (T2.2b)', () => {
  it('구간 = 정류장 순서대로 (정류장 수 − 1), 양 끝은 정류장 좌표', () => {
    expect(courseRoute.legs.map((l) => `${l.from}>${l.to}`)).toEqual(
      stops.slice(1).map((s, i) => `${stops[i].id}>${s.id}`),
    );
    courseRoute.legs.forEach((leg, i) => {
      expect(leg.path[0]).toEqual(stops[i].geo);
      expect(leg.path.at(-1)).toEqual(stops[i + 1].geo);
      expect(leg.distanceM).toBeGreaterThan(0);
    });
  });

  it('출처·계산일·현장 확인 여부를 가짐 (현장 확인 전 = 참고용)', () => {
    expect(courseRoute.source).toContain('OpenStreetMap');
    expect(courseRoute.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(courseRoute.verified).toBe(false);
  });

  it('구간 순서가 다르면 throw', () => {
    const r = clone();
    r.legs = [...r.legs].reverse();
    expect(() => parseCourseRoute(r, stops)).toThrow(/legs\[0\]/);
  });

  it('구간 수가 모자라면 throw', () => {
    const r = clone();
    r.legs = r.legs.slice(1);
    expect(() => parseCourseRoute(r, stops)).toThrow(/구간 수/);
  });

  it('경로 끝이 정류장 좌표가 아니면 throw (좌표만 바꾸고 경로를 다시 계산하지 않은 경우)', () => {
    const moved = stops.map((s, i) =>
      i === 1 ? { ...s, geo: { lat: s.geo.lat + 0.001, lng: s.geo.lng } } : s,
    );
    expect(() => parseCourseRoute(raw, moved)).toThrow(/eun 좌표 아님/);
  });

  it('좌표 형식이 틀리면 throw', () => {
    const r = clone() as unknown as { legs: { path: unknown[] }[] };
    r.legs[0].path[1] = [999, 127];
    expect(() => parseCourseRoute(r, stops)).toThrow(/path\[1\]/);
  });
});
