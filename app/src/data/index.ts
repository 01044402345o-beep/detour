/**
 * 원도심 콘텐츠 진입점 (T1.1). 로드 시 검증하고, 실패하면 throw 합니다.
 * 화면은 이 모듈의 값만 사용하고 downtown.json을 직접 import하지 않습니다.
 */
import raw from './downtown.json';
import routeRaw from './courseRoute.json';
import { parseCourseRoute } from './route';
import { parseContent } from './validate';
import type { ContentPlace, DowntownContent } from './validate';

export type { ContentCourse, ContentMenuItem, ContentPlace, DowntownContent } from './validate';

export const content: DowntownContent = parseContent(raw);
export const course = content.course;
/** 방문 순서(order) 기준으로 정렬된 장소 목록 */
export const places: ContentPlace[] = [...content.places].sort((a, b) => a.order - b.order);

/** 코스 도보 경로 (미리 계산, 참고용). 정류장 순서·좌표와 맞지 않으면 로드 시 throw */
export const courseRoute = parseCourseRoute(
  routeRaw,
  course.stops.map((id) => {
    const p = places.find((q) => q.id === id);
    if (!p) throw new Error(`course stop "${id}" not found`);
    return { id: p.id, geo: p.geo };
  }),
);

export type { CourseRoute, RouteLeg } from './route';

export function getPlace(id: string): ContentPlace | undefined {
  return places.find((p) => p.id === id);
}
