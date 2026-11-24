/**
 * 코스 도보 경로 미리 계산 (T2.2b). 개발할 때 한 번 실행하고, 결과 JSON을 커밋합니다.
 * 앱은 실행 중에 경로 API를 부르지 않습니다(오프라인·외부 호출 없음 유지).
 *
 *   node scripts/gen-course-route.mjs
 *
 * - 경로: OpenStreetMap 데이터 기반 OSRM 도보 프로필 (FOSSGIS 공개 서버, 가벼운 사용만 허용)
 * - 입력: src/data/downtown.json 의 course.start(출발지) + course.stops 순서와 각 장소 geo
 * - 출력: src/data/courseRoute.json (구간마다 [위도, 경도] 목록. 양 끝은 정류장 좌표로 맞춤)
 * - 좌표가 바뀌거나 현장 확인으로 길이 달라지면 다시 실행하고, 결과를 지도로 확인합니다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src', 'data', 'downtown.json');
const OUT = join(ROOT, 'src', 'data', 'courseRoute.json');
const ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const SOURCE = 'OSRM foot profile (routing.openstreetmap.de) · © OpenStreetMap contributors';

const round5 = (n) => Math.round(n * 1e5) / 1e5;

const content = JSON.parse(readFileSync(DATA, 'utf8'));
const byId = new Map(content.places.map((p) => [p.id, p]));
const stops = [
  content.course.start,
  ...content.course.stops.map((id) => {
    const p = byId.get(id);
    if (!p) throw new Error(`stop not found: ${id}`);
    return p;
  }),
];

const legs = [];
for (let i = 1; i < stops.length; i += 1) {
  const a = stops[i - 1];
  const b = stops[i];
  const url = `${ENDPOINT}/${a.geo.lng},${a.geo.lat};${b.geo.lng},${b.geo.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { headers: { 'User-Agent': 'course-route-precompute' } });
  if (!res.ok) throw new Error(`${a.id}->${b.id}: HTTP ${res.status}`);
  const json = await res.json();
  const route = json.routes?.[0];
  if (json.code !== 'Ok' || !route) throw new Error(`${a.id}->${b.id}: ${json.code}`);
  const path = route.geometry.coordinates.map(([lng, lat]) => [round5(lat), round5(lng)]);
  // 경로는 가장 가까운 길에 붙어 시작·끝나므로 정류장 좌표를 양 끝에 붙여 핀과 이어지게 합니다
  path.unshift([a.geo.lat, a.geo.lng]);
  path.push([b.geo.lat, b.geo.lng]);
  legs.push({ from: a.id, to: b.id, distanceM: Math.round(route.distance), path });
  console.log(`${a.id} -> ${b.id}: ${Math.round(route.distance)} m, ${path.length} points`);
}

const out = {
  source: SOURCE,
  computedAt: new Date().toISOString().slice(0, 10),
  verified: false,
  note: '정류장 좌표가 현장 확인 전 예시값이므로 경로도 참고용. 현장 확인(T4.1) 때 실제로 걸어 보고 보정',
  legs,
};
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${OUT}`);
