import { createMemoryStorage, createSafeStorage } from './safeStorage';

/** setItem이 특정 시점부터 던지는 가짜 Storage */
function flakyStorage(opts: { failAccess?: boolean; failWriteAfter?: number } = {}): Storage {
  const map = new Map<string, string>();
  let writes = 0;
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => {
      if (opts.failAccess) throw new Error('SecurityError');
      return map.get(k) ?? null;
    },
    setItem: (k, v) => {
      if (opts.failAccess) throw new Error('SecurityError');
      writes++;
      if (opts.failWriteAfter !== undefined && writes > opts.failWriteAfter) {
        throw new Error('QuotaExceededError');
      }
      map.set(k, v);
    },
    removeItem: (k) => void map.delete(k),
  };
}

describe('createSafeStorage', () => {
  it('localStorage가 정상이면 local 모드로 읽고 쓴다', () => {
    const ls = flakyStorage();
    const s = createSafeStorage(() => ls);
    expect(s.mode).toBe('local');
    s.setItem('k', 'v');
    expect(ls.getItem('k')).toBe('v');
    expect(s.getItem('k')).toBe('v');
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
  });

  it('접근이 막히면(SecurityError) 처음부터 메모리 모드', () => {
    const s = createSafeStorage(() => flakyStorage({ failAccess: true }));
    expect(s.mode).toBe('memory');
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
  });

  it('localStorage 접근 자체가 던지거나 없으면 메모리 모드', () => {
    expect(
      createSafeStorage(() => {
        throw new Error('blocked');
      }).mode,
    ).toBe('memory');
    expect(createSafeStorage(() => undefined).mode).toBe('memory');
  });

  it('도중에 쓰기가 실패하면(용량 초과) 메모리로 넘어가고 값을 잃지 않는다', () => {
    // probe 1회 + 정상 쓰기 1회 후 실패
    const ls = flakyStorage({ failWriteAfter: 2 });
    const s = createSafeStorage(() => ls);
    s.setItem('a', '1');
    expect(s.mode).toBe('local');
    s.setItem('a', '2');
    expect(s.mode).toBe('memory');
    expect(s.getItem('a')).toBe('2');
  });

  it('local에서 읽어 둔 값은 메모리로 넘어간 뒤에도 남는다', () => {
    const ls = flakyStorage({ failWriteAfter: 2 });
    ls.setItem('b', 'old'); // 쓰기 1회 사용 (probe가 2회째)
    const s = createSafeStorage(() => ls);
    expect(s.getItem('b')).toBe('old');
    s.setItem('c', 'new'); // 3회째 → 실패
    expect(s.mode).toBe('memory');
    expect(s.getItem('b')).toBe('old');
    expect(s.getItem('c')).toBe('new');
  });
});

describe('createSafeStorage — R1 M-02·M-03', () => {
  it('M-02: probe 쓰기만 실패하면 기존 값은 계속 읽는다', () => {
    const ls = flakyStorage({ failWriteAfter: 1 });
    ls.setItem('k', 'old'); // 쓰기 1회 사용 → probe부터 실패
    const s = createSafeStorage(() => ls);
    expect(s.mode).toBe('memory');
    expect(s.getItem('k')).toBe('old');
  });

  it('M-03: 쓰기 실패 시 옛 값을 지워 원본에 스냅숏이 남지 않고, 메모리 값이 우선', () => {
    const ls = flakyStorage({ failWriteAfter: 2 });
    const s = createSafeStorage(() => ls);
    s.setItem('k', 'v1'); // 성공
    expect(ls.getItem('k')).toBe('v1');
    s.setItem('k', 'v2'); // 실패 → 원본 삭제 → 재시도 실패
    expect(ls.getItem('k')).toBeNull();
    expect(s.mode).toBe('memory');
    expect(s.getItem('k')).toBe('v2');
  });

  it('M-03: 쓰기 불가여도 removeItem은 원본에서 지운다', () => {
    const ls = flakyStorage({ failWriteAfter: 1 });
    ls.setItem('k', 'old');
    const s = createSafeStorage(() => ls);
    s.removeItem('k');
    expect(ls.getItem('k')).toBeNull();
    expect(s.getItem('k')).toBeNull();
  });
});

describe('createMemoryStorage', () => {
  it('Map 기반으로 읽고 쓴다', () => {
    const m = createMemoryStorage();
    m.setItem('k', 'v');
    expect(m.getItem('k')).toBe('v');
    expect(m.size).toBe(1);
    m.removeItem('k');
    expect(m.getItem('k')).toBeNull();
  });
});
