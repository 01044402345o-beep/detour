import { isPrecacheComplete } from './messages';

describe('isPrecacheComplete — 오프라인 준비 완료 조건', () => {
  it('전부 캐시됐을 때만 참', () => {
    expect(isPrecacheComplete({ total: 52, cached: 52 })).toBe(true);
    expect(isPrecacheComplete({ total: 52, cached: 51 })).toBe(false);
  });
  it('목록이 비었거나 상태가 없으면 거짓', () => {
    expect(isPrecacheComplete({ total: 0, cached: 0 })).toBe(false);
    expect(isPrecacheComplete(null)).toBe(false);
    expect(isPrecacheComplete(undefined)).toBe(false);
  });
});
