/**
 * 코스 도보 경로 (T2.2b). scripts/gen-course-route.mjs 로 미리 계산한 courseRoute.json 을 검증해 씁니다.
 * 앱은 실행 중에 경로를 계산하지 않습니다. 정류장 좌표가 예시값이므로 경로도 참고용입니다.
 */
import type { GeoPoint } from '../types';

export type RouteLeg = {
  from: string;
  to: string;
  distanceM: number;
  /** 구간 경로 (양 끝 = 출발·도착 정류장 좌표) */
  path: GeoPoint[];
};

export type CourseRoute = {
  source: string;
  computedAt: string;
  verified: boolean;
  note?: string;
  legs: RouteLeg[];
};

/** 경로 양 끝이 정류장 좌표와 이 거리(m) 안이어야 합니다 */
const END_TOLERANCE_M = 1;

function metersBetween(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function toPoint(v: unknown): GeoPoint | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [lat, lng] = v;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * courseRoute.json 을 검증합니다. 구간은 stops 순서대로 이어져야 하고(정류장 수 − 1개),
 * 각 구간의 양 끝은 해당 정류장 좌표여야 합니다. 실패하면 throw 합니다.
 */
export function parseCourseRoute(
  input: unknown,
  stops: readonly { id: string; geo: GeoPoint }[],
): CourseRoute {
  const errs: string[] = [];
  const fail = (path: string, msg: string) => errs.push(`${path}: ${msg}`);
  if (!isObj(input)) throw new Error('courseRoute: 객체 아님');
  const { source, computedAt, verified, note, legs } = input;
  if (typeof source !== 'string' || source.trim() === '') fail('$.source', '빈 문자열');
  if (typeof computedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(computedAt))
    fail('$.computedAt', 'YYYY-MM-DD 아님');
  if (typeof verified !== 'boolean') fail('$.verified', 'boolean 아님');
  if (note !== undefined && typeof note !== 'string') fail('$.note', '문자열 아님');
  const out: RouteLeg[] = [];
  if (!Array.isArray(legs)) {
    fail('$.legs', '배열 아님');
  } else {
    if (legs.length !== Math.max(0, stops.length - 1))
      fail('$.legs', `구간 수 ${legs.length} ≠ 정류장 수 − 1 (${stops.length - 1})`);
    legs.forEach((leg: unknown, i) => {
      const p = `$.legs[${i}]`;
      const a = stops[i];
      const b = stops[i + 1];
      if (!isObj(leg)) return fail(p, '객체 아님');
      if (!a || !b) return;
      if (leg.from !== a.id || leg.to !== b.id)
        fail(p, `${String(leg.from)}→${String(leg.to)} ≠ ${a.id}→${b.id}`);
      if (typeof leg.distanceM !== 'number' || !(leg.distanceM > 0))
        fail(`${p}.distanceM`, '양수 아님');
      if (!Array.isArray(leg.path) || leg.path.length < 2) return fail(`${p}.path`, '점 2개 미만');
      const pts = leg.path.map(toPoint);
      const bad = pts.findIndex((q) => q === null);
      if (bad >= 0) return fail(`${p}.path[${bad}]`, '[위도, 경도] 아님');
      const path = pts as GeoPoint[];
      if (metersBetween(path[0], a.geo) > END_TOLERANCE_M)
        fail(`${p}.path[0]`, `${a.id} 좌표 아님`);
      if (metersBetween(path[path.length - 1], b.geo) > END_TOLERANCE_M)
        fail(`${p}.path[-1]`, `${b.id} 좌표 아님`);
      out.push({ from: a.id, to: b.id, distanceM: leg.distanceM as number, path });
    });
  }
  if (errs.length > 0) throw new Error(`courseRoute 검증 실패\n${errs.join('\n')}`);
  return {
    source: source as string,
    computedAt: computedAt as string,
    verified: verified as boolean,
    ...(typeof note === 'string' ? { note } : {}),
    legs: out,
  };
}
