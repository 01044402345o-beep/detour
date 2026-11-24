/**
 * 코스 콘텐츠 진입점 (T1.1, 코스 여러 개 — T5.1). 로드 시 검증하고, 실패하면 throw 합니다.
 * 화면은 이 모듈의 값만 사용하고 코스 JSON을 직접 import하지 않습니다.
 *
 * 코스 하나 = 콘텐츠 JSON(거점·코스·장소) + 미리 계산한 도보 경로 JSON.
 * 다른 시장·축제 코스는 같은 형식의 두 파일을 만들고 아래 PACKS에 한 줄 추가하면 됩니다.
 */
import downtownRaw from './downtown.json';
import downtownRouteRaw from './downtown.route.json';
import marketRaw from './market.json';
import marketRouteRaw from './market.route.json';
import { parseCourseRoute, type CourseRoute } from './route';
import { parseContent } from './validate';
import type { ContentCourse, ContentPack, ContentPlace } from './validate';

export type {
  ContentCourse,
  ContentMenuItem,
  ContentPack,
  ContentPlace,
  DowntownContent,
} from './validate';
export type { CourseRoute, RouteLeg } from './route';

/** 검증을 마친 코스 하나 */
export type CourseBundle = {
  course: ContentCourse;
  /** 이 코스의 장소 (방문 순서) */
  places: ContentPlace[];
  route: CourseRoute;
};

function bundle(raw: unknown, routeRaw: unknown): CourseBundle {
  const pack: ContentPack = parseContent(raw);
  const sorted = [...pack.places].sort((a, b) => a.order - b.order);
  const route = parseCourseRoute(routeRaw, [
    { id: pack.course.start.id, geo: pack.course.start.geo },
    ...sorted.map((p) => ({ id: p.id, geo: p.geo })),
  ]);
  return { course: pack.course, places: sorted, route };
}

/** 모든 코스 (첫 번째가 기본 코스 = 원도심) */
export const bundles: readonly CourseBundle[] = [
  bundle(downtownRaw, downtownRouteRaw),
  bundle(marketRaw, marketRouteRaw),
];

// 코스가 달라도 장소·메뉴·문장 ID는 앱 전체에서 하나여야 합니다 (기록·주문·북마크가 ID만 저장)
{
  const seen = new Set<string>();
  for (const b of bundles) {
    const ids = [
      `course:${b.course.id}`,
      // 행사는 코스에 속하므로 앱 전체에서도 하나 (R1 L-2)
      ...(b.course.events ?? []).map((e) => `event:${e.id}`),
      ...b.places.flatMap((p) => [
        `place:${p.id}`,
        ...(p.menu ?? []).map((m) => `menu:${m.id}`),
        ...p.phrases.map((ph) => `phrase:${ph.id}`),
      ]),
    ];
    for (const id of ids) {
      if (seen.has(id)) throw new Error(`콘텐츠 ID 중복 (코스 사이): ${id}`);
      seen.add(id);
    }
  }
}

export const courses: readonly ContentCourse[] = bundles.map((b) => b.course);

/** 기본 코스 (원도심). 코스를 지정하지 않은 화면·링크가 씁니다 */
export const course: ContentCourse = bundles[0].course;
/** 기본 코스의 도보 경로 */
export const courseRoute: CourseRoute = bundles[0].route;
/** 이전 이름: 기본 코스 콘텐츠 */
export const content = { hub: course.hub, course, places: bundles[0].places };

/** 모든 코스의 장소 (코스 순서 → 방문 순서) */
export const places: ContentPlace[] = bundles.flatMap((b) => b.places);

export function getPlace(id: string): ContentPlace | undefined {
  return places.find((p) => p.id === id);
}

/** 코스 id → 코스 묶음 (없으면 undefined) */
export function getBundle(courseId: string): CourseBundle | undefined {
  return bundles.find((b) => b.course.id === courseId);
}

/** 장소가 속한 코스 묶음 */
export function bundleOfPlace(placeId: string): CourseBundle | undefined {
  return bundles.find((b) => b.places.some((p) => p.id === placeId));
}
