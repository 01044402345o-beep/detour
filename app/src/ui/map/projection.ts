import type { GeoPoint } from '../../types';

export type Box = { width: number; height: number; padding: number };
export type XY = { x: number; y: number };

/**
 * 위경도를 SVG 약도 좌표로 옮깁니다 (등장방형 + 위도 보정, 가로·세로 같은 축척).
 * 점들의 범위를 상자 안쪽(padding 제외) 가운데에 맞춥니다. 북쪽이 위.
 */
export function projectToBox(points: readonly GeoPoint[], box: Box): XY[] {
  if (points.length === 0) return [];
  const lat0 = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lng * kx);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const innerW = box.width - box.padding * 2;
  const innerH = box.height - box.padding * 2;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(
    spanX > 0 ? innerW / spanX : Infinity,
    spanY > 0 ? innerH / spanY : Infinity,
  );
  const s = Number.isFinite(scale) ? scale : 0;
  const offX = box.padding + (innerW - spanX * s) / 2;
  const offY = box.padding + (innerH - spanY * s) / 2;
  return points.map((_, i) => ({
    x: Math.round((offX + (xs[i] - minX) * s) * 10) / 10,
    y: Math.round((offY + (maxY - ys[i]) * s) * 10) / 10,
  }));
}

/**
 * 가까운 점끼리 최소 거리(minD)만큼 벌립니다 (핀 터치 영역이 겹치지 않게, T5.1).
 * 시장처럼 정류장이 수십 m 간격이면 투영 후 핀이 겹치므로, 겹친 쌍을 서로 반대 방향으로 밀어냅니다.
 * - box: 주면 그 상자(여백 margin) 안으로 제한합니다(약도). 타일 지도는 뷰포트와 무관해야 하므로 주지 않습니다(R2 M-1).
 * - maxMove: 반발 단계에서 각 점이 원래 위치에서 움직일 수 있는 최대 거리. 그래도 겹치면
 *   무리를 원 위에 펼칩니다(이동량은 원 반지름 + 무리 크기 — 핀 4개면 약 0.71·minD + 무리 크기).
 * 겹침이 없으면 입력을 그대로 돌려줍니다.
 */
export function separate(
  points: readonly XY[],
  minD: number,
  opts: {
    box?: { width: number; height: number; margin: number };
    maxMove?: number;
  } = {},
): XY[] {
  const { box, maxMove = Infinity } = opts;
  const out = points.map((p) => ({ ...p }));
  const fit = (i: number) => {
    const o = points[i];
    const p = out[i];
    if (box) {
      p.x = Math.min(Math.max(p.x, box.margin), box.width - box.margin);
      p.y = Math.min(Math.max(p.y, box.margin), box.height - box.margin);
    }
    const d = Math.hypot(p.x - o.x, p.y - o.y);
    if (d > maxMove) {
      p.x = o.x + ((p.x - o.x) * maxMove) / d;
      p.y = o.y + ((p.y - o.y) * maxMove) / d;
    }
  };
  for (let pass = 0; pass < 60; pass += 1) {
    let moved = false;
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const dx = out[j].x - out[i].x;
        const dy = out[j].y - out[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        // 같은 자리면 가로로 벌림
        const ux = d > 0 ? dx / d : 1;
        const uy = d > 0 ? dy / d : 0;
        const push = (minD - d) / 2 + 0.5;
        out[i].x -= ux * push;
        out[i].y -= uy * push;
        out[j].x += ux * push;
        out[j].y += uy * push;
        fit(i);
        fit(j);
        moved = true;
      }
    }
    if (!moved) break;
  }

  // 반발로도 남는 겹침(낮은 줌에서 같은 점·일직선으로 모인 경우, R3 M-1)은
  // 원래 거리로 이어진 무리를 무리 중심 둘레 원 위에 고르게 놓아 2차원으로 펼칩니다.
  // 반지름 R = minD / (2·sin(π/n)) — 이웃 핀 사이가 minD. 4개면 약 0.71·minD.
  const close = (i: number, j: number) =>
    Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) < minD - 0.05;
  const stillOverlaps = out.some((_, i) => out.some((__, j) => j > i && close(i, j)));
  if (stillOverlaps) {
    const group = points.map((_, i) => i);
    const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i])));
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        if (d < minD) group[root(i)] = root(j);
      }
    }
    const clusters = new Map<number, number[]>();
    points.forEach((_, i) => clusters.set(root(i), [...(clusters.get(root(i)) ?? []), i]));
    for (const members of clusters.values()) {
      const n = members.length;
      if (n < 2) continue;
      const cx = members.reduce((a, i) => a + points[i].x, 0) / n;
      const cy = members.reduce((a, i) => a + points[i].y, 0) / n;
      const r = minD / (2 * Math.sin(Math.PI / n)) + 0.5;
      // 원래 방향 순서를 유지 (같은 점이면 번호 순)
      const order = [...members].sort((i, j) => {
        const ai = Math.atan2(points[i].y - cy, points[i].x - cx);
        const aj = Math.atan2(points[j].y - cy, points[j].x - cx);
        const same = (k: number) => Math.hypot(points[k].x - cx, points[k].y - cy) < 0.5;
        return same(i) || same(j) ? i - j : ai - aj;
      });
      order.forEach((i, k) => {
        const th = -Math.PI / 2 + (2 * Math.PI * k) / n;
        out[i].x = cx + r * Math.cos(th);
        out[i].y = cy + r * Math.sin(th);
        if (box) {
          out[i].x = Math.min(Math.max(out[i].x, box.margin), box.width - box.margin);
          out[i].y = Math.min(Math.max(out[i].y, box.margin), box.height - box.margin);
        }
      });
    }
  }
  return out.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}
