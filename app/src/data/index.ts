/**
 * 원도심 콘텐츠 진입점 (T1.1). 로드 시 검증하고, 실패하면 throw 합니다.
 * 화면은 이 모듈의 값만 사용하고 downtown.json을 직접 import하지 않습니다.
 */
import raw from './downtown.json';
import { parseContent } from './validate';
import type { ContentPlace, DowntownContent } from './validate';

export type { ContentCourse, ContentMenuItem, ContentPlace, DowntownContent } from './validate';

export const content: DowntownContent = parseContent(raw);
export const course = content.course;
/** 방문 순서(order) 기준으로 정렬된 장소 목록 */
export const places: ContentPlace[] = [...content.places].sort((a, b) => a.order - b.order);

export function getPlace(id: string): ContentPlace | undefined {
  return places.find((p) => p.id === id);
}
