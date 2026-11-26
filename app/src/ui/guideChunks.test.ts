import { COURSE_GUIDES, PLACE_GUIDES } from '../data/guides';
import { LANGS } from '../types';
import { GUIDE_CHUNK_MAX, chunkGuide } from './guideChunks';

describe('chunkGuide (T6.17)', () => {
  it('문단 안에서 2문장씩, 문단을 넘어 묶지 않음(홀수 문단의 마지막은 혼자)', () => {
    const r = chunkGuide(
      [
        ['a.', 'b.', 'c.'],
        ['d.', 'e.'],
      ],
      100,
    );
    expect(r.chunks).toEqual([[0, 1], [2], [3, 4]]);
    expect(r.chunkOf).toEqual([0, 0, 1, 2, 2]);
  });

  it('두 문장을 합친 길이가 상한을 넘으면 1문장만, 상한과 같으면 2문장', () => {
    const long = 'x'.repeat(60);
    const r = chunkGuide([[long, long, 'short.']], 100);
    expect(r.chunks).toEqual([[0], [1, 2]]);
    expect(chunkGuide([['x'.repeat(50), 'y'.repeat(50)]], 100).chunks).toEqual([[0, 1]]);
    expect(chunkGuide([['x'.repeat(50), 'y'.repeat(51)]], 100).chunks).toEqual([[0], [1]]);
  });

  it('실제 가이드 원고 전부: 모든 문장이 순서대로 한 번씩, 묶음은 1~2문장, 2문장 묶음은 상한 이하', () => {
    const all = { ...COURSE_GUIDES, ...PLACE_GUIDES };
    for (const [id, g] of Object.entries(all)) {
      for (const lang of LANGS) {
        const flat = g[lang].flat();
        const { chunks, chunkOf } = chunkGuide(g[lang], GUIDE_CHUNK_MAX[lang]);
        expect(chunks.flat(), `${id} ${lang}`).toEqual(flat.map((_, i) => i));
        expect(chunkOf).toHaveLength(flat.length);
        chunks.forEach((c, k) => c.forEach((i) => expect(chunkOf[i]).toBe(k)));
        for (const c of chunks) {
          expect(c.length).toBeGreaterThanOrEqual(1);
          expect(c.length).toBeLessThanOrEqual(2);
          if (c.length === 2)
            expect(flat[c[0]].length + flat[c[1]].length).toBeLessThanOrEqual(
              GUIDE_CHUNK_MAX[lang],
            );
        }
      }
    }
  });
});
