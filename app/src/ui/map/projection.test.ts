import { places } from '../../data';
import { projectToBox } from './projection';

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
