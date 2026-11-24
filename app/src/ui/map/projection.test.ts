import { places } from '../../data';
import { projectToBox, separate } from './projection';

const box = { width: 310, height: 290, padding: 40 };

describe('projectToBox', () => {
  it('모든 점이 상자 안쪽(padding 안)에 들어감', () => {
    const xy = projectToBox(
      places.map((p) => p.geo),
      box,
    );
    expect(xy).toHaveLength(places.length);
    for (const p of xy) {
      expect(p.x).toBeGreaterThanOrEqual(box.padding - 0.1);
      expect(p.x).toBeLessThanOrEqual(box.width - box.padding + 0.1);
      expect(p.y).toBeGreaterThanOrEqual(box.padding - 0.1);
      expect(p.y).toBeLessThanOrEqual(box.height - box.padding + 0.1);
    }
  });

  it('북쪽이 위, 동쪽이 오른쪽', () => {
    const [a, b] = projectToBox(
      [
        { lat: 36.33, lng: 127.42 },
        { lat: 36.32, lng: 127.43 },
      ],
      box,
    );
    expect(a.y).toBeLessThan(b.y);
    expect(a.x).toBeLessThan(b.x);
  });

  it('가로·세로 축척이 같음 (동서로 긴 범위면 세로는 가운데 정렬)', () => {
    const [a, b] = projectToBox(
      [
        { lat: 36.33, lng: 127.42 },
        { lat: 36.33, lng: 127.44 },
      ],
      box,
    );
    expect(a.y).toBe(b.y);
    expect(a.y).toBe(box.height / 2);
    expect(a.x).toBe(box.padding);
    expect(b.x).toBe(box.width - box.padding);
  });

  it('빈 목록·한 점도 깨지지 않음', () => {
    expect(projectToBox([], box)).toEqual([]);
    const [p] = projectToBox([{ lat: 36.33, lng: 127.42 }], box);
    expect(p).toEqual({ x: box.width / 2, y: box.height / 2 });
  });
});

describe('separate (가까운 핀 벌리기, T5.1)', () => {
  const box = { width: 360, height: 290, margin: 0 };
  it('이미 충분히 떨어져 있으면 그대로', () => {
    const pts = [
      { x: 10, y: 10 },
      { x: 100, y: 100 },
    ];
    expect(separate(pts, 50, { box })).toEqual(pts);
  });

  it('겹치면 최소 거리 이상으로 벌리고, 각 점의 이동은 최소 거리 이내', () => {
    const pts = [
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 105, y: 108 },
    ];
    const out = separate(pts, 46, { box });
    for (let i = 0; i < out.length; i += 1) {
      expect(Math.hypot(out[i].x - pts[i].x, out[i].y - pts[i].y)).toBeLessThanOrEqual(46);
      for (let j = i + 1; j < out.length; j += 1) {
        expect(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y)).toBeGreaterThanOrEqual(45.9);
      }
    }
  });

  it('같은 자리여도 벌림, 상자 밖으로 나가지 않음', () => {
    const out = separate(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      46,
      { box: { ...box, margin: 5 } },
    );
    expect(Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y)).toBeGreaterThanOrEqual(45.9);
    out.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(5);
      expect(p.y).toBeGreaterThanOrEqual(5);
    });
  });
});

describe('separate: 상자 없이(타일 지도) 화면 밖 좌표도 그대로, 이동량 제한 (R2 M-1)', () => {
  it('음수·큰 좌표를 상자 안으로 끌어오지 않음', () => {
    const pts = [
      { x: -90, y: 100 },
      { x: -80, y: 100 },
    ];
    const out = separate(pts, 46, { maxMove: 44 });
    out.forEach((p, i) => {
      expect(p.x).toBeLessThan(0);
      expect(Math.hypot(p.x - pts[i].x, p.y - pts[i].y)).toBeLessThanOrEqual(44);
    });
    expect(Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y)).toBeGreaterThanOrEqual(45.9);
  });

  it('반발로 풀리는 겹침은 maxMove 이내로만 움직임', () => {
    const pts = [
      { x: 100, y: 100 },
      { x: 130, y: 100 },
    ];
    const out = separate(pts, 46, { maxMove: 20 });
    out.forEach((p, i) => {
      expect(Math.hypot(p.x - pts[i].x, p.y - pts[i].y)).toBeLessThanOrEqual(20.05);
    });
    expect(Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y)).toBeGreaterThanOrEqual(45.9);
  });

  it('maxMove로 못 푸는 무리(5개)는 겹침 해소가 우선 — 원 반지름(약 0.85·minD) + 무리 크기 이내로 이동', () => {
    const pts = Array.from({ length: 5 }, (_, i) => ({ x: 100 + i, y: 100 }));
    const out = separate(pts, 46, { maxMove: 20 });
    out.forEach((a, i) =>
      out
        .slice(i + 1)
        .forEach((b) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(45.9)),
    );
    const r = 46 / (2 * Math.sin(Math.PI / 5)) + 0.5;
    out.forEach((p, i) => {
      expect(Math.hypot(p.x - pts[i].x, p.y - pts[i].y)).toBeLessThanOrEqual(r + 4);
    });
  });
});

describe('separate: 같은 점·일직선으로 모인 무리를 원 위에 펼침 (R3 M-1)', () => {
  const pairs = (out: { x: number; y: number }[]) =>
    out.flatMap((a, i) => out.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)));

  it('같은 점 4개 → 서로 46px 이상, 각 이동 46px 이내 (maxMove 44여도)', () => {
    const pts = Array.from({ length: 4 }, () => ({ x: 180, y: 144 }));
    const out = separate(pts, 46, { maxMove: 44 });
    pairs(out).forEach((d) => expect(d).toBeGreaterThanOrEqual(45.9));
    out.forEach((p) => expect(Math.hypot(p.x - 180, p.y - 144)).toBeLessThanOrEqual(46));
  });

  it('일직선 4개(1px 간격) → 2차원으로 펼침', () => {
    const pts = [
      { x: 180, y: 144 },
      { x: 179, y: 144 },
      { x: 180, y: 144 },
      { x: 181, y: 144 },
    ];
    const out = separate(pts, 46, { maxMove: 44 });
    pairs(out).forEach((d) => expect(d).toBeGreaterThanOrEqual(45.9));
    expect(new Set(out.map((p) => Math.round(p.y))).size).toBeGreaterThan(1);
  });
});
