import { chipSize, placeChips, pointAlong, rectAround, rectsOverlap } from './chips';

describe('구간 분 칩 자리 (T6.3)', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('pointAlong: 길이 기준 위치', () => {
    expect(pointAlong(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(path, 0.5)).toEqual({ x: 100, y: 0 });
    expect(pointAlong(path, 0.25)).toEqual({ x: 50, y: 0 });
    expect(pointAlong(path, 1)).toEqual({ x: 100, y: 100 });
    expect(pointAlong([{ x: 3, y: 4 }], 0.5)).toEqual({ x: 3, y: 4 });
  });

  it('가운데가 비어 있으면 가운데', () => {
    expect(placeChips([{ path, w: 40, h: 16 }], [])).toEqual([{ x: 100, y: 0 }]);
  });

  it('가운데가 핀과 겹치면 다른 후보로, 칩끼리도 겹치지 않음', () => {
    const pin = rectAround({ x: 100, y: 0 }, 34, 34);
    const [a, b] = placeChips(
      [
        { path, w: 40, h: 16 },
        { path, w: 40, h: 16 },
      ],
      [pin],
    );
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const ra = rectAround(a!, 40, 16);
    const rb = rectAround(b!, 40, 16);
    expect(rectsOverlap(ra, pin)).toBe(false);
    expect(rectsOverlap(ra, rb)).toBe(false);
  });

  it('놓을 자리가 없으면 null (숨김), 상자 밖도 안 됨', () => {
    const short = [
      { x: 50, y: 50 },
      { x: 60, y: 50 },
    ];
    expect(
      placeChips([{ path: short, w: 40, h: 16 }], [rectAround({ x: 55, y: 50 }, 60, 60)]),
    ).toEqual([null]);
    expect(placeChips([{ path: short, w: 40, h: 16 }], [], { width: 70, height: 100 })).toEqual([
      null,
    ]);
  });

  it('chipSize: 글자 수에 비례', () => {
    expect(chipSize('12 min', 11).w).toBeGreaterThan(chipSize('2分', 11).w);
    expect(chipSize('2 min', 10).h).toBe(17);
  });
});
