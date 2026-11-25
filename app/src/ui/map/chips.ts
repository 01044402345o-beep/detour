/**
 * 구간 분 칩 자리 고르기 (T6.3, DESIGN.md 7장 '코스'·9장 '지도 라벨·핀은 겹치지 않게').
 * 타일 지도와 약도가 같은 규칙을 씁니다: 구간 경로의 가운데(길이 기준)부터 앞뒤로 후보를 옮겨 가며
 * 핀·출발 표시·이미 놓은 칩과 겹치지 않고 상자 안에 들어오는 첫 자리에 칩을 둡니다.
 * 들어갈 자리가 없으면 그 칩은 숨깁니다(분은 정류장 목록에 늘 있음).
 */
import type { XY } from './projection';

/** 왼쪽 위 기준 사각형 */
export type Rect = { x: number; y: number; w: number; h: number };

/** 길이 기준 후보 위치 (가운데 먼저) */
export const CHIP_FRACTIONS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8] as const;

/** 칩 크기 추정: 글자 폭(한자·가나·한글은 1em, 고정폭 숫자·영문은 0.62em) + 좌우 여백 */
export function chipSize(label: string, font: number): { w: number; h: number } {
  return { w: Math.ceil(textWidth(label, font) + 12), h: Math.ceil(font + 7) };
}

/** 한자·가나·한글 (넓은 글자) */
const WIDE = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/;

/** 글자 폭 추정 (이름표 크기): 한자·가나·한글은 1em, 그 밖은 0.62em */
export function textWidth(text: string, font: number): number {
  return [...text].reduce((a, ch) => a + (WIDE.test(ch) ? 1 : 0.62), 0) * font;
}

/** 꺾은선 위에서 전체 길이의 f(0~1) 지점 */
export function pointAlong(path: readonly XY[], f: number): XY {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];
  const seg = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
  const total = seg.reduce((a, b) => a + b, 0);
  if (total === 0) return path[0];
  let left = total * f;
  for (let i = 0; i < seg.length; i += 1) {
    if (left <= seg[i] || i === seg.length - 1) {
      const k = seg[i] === 0 ? 0 : Math.min(left / seg[i], 1);
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * k,
        y: path[i].y + (path[i + 1].y - path[i].y) * k,
      };
    }
    left -= seg[i];
  }
  return path[path.length - 1];
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  );
}

/** 점을 가운데로 하는 사각형 */
export function rectAround(c: XY, w: number, h: number): Rect {
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

export type ChipLeg = { path: readonly XY[]; w: number; h: number };

/** 칩과 선 사이 틈 (선 옆에 둘 때) */
const SIDE_GAP = 4;

/**
 * 후보 자리: 길이 비율마다 선 위 → 선 양옆(선에 수직으로, 칩이 선에 닿을 만큼만 떨어짐).
 * 짧은 구간(시장 등)은 선 위에 자리가 없어도 옆에 놓을 수 있습니다(시안 c2-course처럼 선 옆 칩).
 */
function candidates(leg: ChipLeg): XY[] {
  const out: XY[] = [];
  for (const f of CHIP_FRACTIONS) {
    const c = pointAlong(leg.path, f);
    const a = pointAlong(leg.path, Math.max(0, f - 0.05));
    const b = pointAlong(leg.path, Math.min(1, f + 0.05));
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    out.push(c);
    if (len === 0) continue;
    // 선의 수직 방향
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const d = Math.abs(nx) * (leg.w / 2) + Math.abs(ny) * (leg.h / 2) + SIDE_GAP;
    out.push({ x: c.x + nx * d, y: c.y + ny * d }, { x: c.x - nx * d, y: c.y - ny * d });
  }
  return out;
}

/**
 * 구간마다 칩 가운데 좌표(놓을 수 없으면 null).
 * obstacles: 핀·출발 표시 등 칩이 덮으면 안 되는 사각형. bounds: 주면 칩이 이 상자(여백 margin) 안에만 놓입니다.
 */
export function placeChips(
  legs: readonly ChipLeg[],
  obstacles: readonly Rect[],
  bounds?: { width: number; height: number; margin?: number },
  gap = 2,
): (XY | null)[] {
  const placed: Rect[] = [];
  return legs.map((leg) => {
    for (const c of candidates(leg)) {
      const r = rectAround(c, leg.w, leg.h);
      if (bounds) {
        const m = bounds.margin ?? 0;
        if (r.x < m || r.y < m || r.x + r.w > bounds.width - m || r.y + r.h > bounds.height - m) {
          continue;
        }
      }
      if (obstacles.some((o) => rectsOverlap(r, o, gap))) continue;
      if (placed.some((o) => rectsOverlap(r, o, gap))) continue;
      placed.push(r);
      return { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 };
    }
    return null;
  });
}
