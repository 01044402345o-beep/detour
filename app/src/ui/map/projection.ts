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
