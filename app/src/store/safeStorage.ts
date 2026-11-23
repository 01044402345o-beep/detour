import type { StateStorage } from 'zustand/middleware';

/** 메모리 저장소 (localStorage를 쓸 수 없을 때의 대체) */
export function createMemoryStorage(): StateStorage<void> & { readonly size: number } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    get size() {
      return map.size;
    },
  };
}

/**
 * localStorage를 감싼 저장소 (T1.6, R1 M-02·M-03 반영).
 *
 * - 읽기 가능(`local` 핸들)과 쓰기 가능(`writable`)을 따로 다룹니다.
 *   쓰기만 실패하면(용량 초과) 핸들을 유지해 기존 값을 계속 읽고, 삭제도 계속 시도합니다.
 *   읽기까지 던지면(접근 차단) 핸들을 버리고 메모리만 씁니다.
 * - 쓰기에 실패하면 그 key의 **옛 값을 지운 뒤** 한 번 더 씁니다. 그래도 실패하면
 *   (삭제가 성공한 경우) localStorage에는 옛 스냅숏이 남지 않으므로, 초기화한 기록이 다음 실행에
 *   되살아나지 않습니다. 이 경우 값은 메모리에만 남습니다(휘발).
 * - 모든 값은 메모리에도 함께 둡니다.
 * - `mode`: 읽고 쓸 수 있으면 'local', 쓰기 불가이거나 접근 불가면 'memory'.
 */
export function createSafeStorage(
  getStorage: () => Storage | undefined = () => globalThis.localStorage,
): StateStorage<void> & { readonly mode: 'local' | 'memory' } {
  const memory = createMemoryStorage();
  let local: Storage | undefined;
  let writable = false;
  try {
    local = getStorage();
  } catch {
    local = undefined;
  }
  if (local) {
    const probe = '__detour_probe__';
    try {
      local.setItem(probe, '1');
      writable = true;
    } catch {
      writable = false;
    }
    try {
      local.removeItem(probe);
    } catch {
      /* 무시 */
    }
  }

  const tryRemove = (k: string) => {
    if (!local) return;
    try {
      local.removeItem(k);
    } catch {
      local = undefined;
      writable = false;
    }
  };

  const trySet = (k: string, v: string): boolean => {
    if (!local) return false;
    try {
      local.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  };

  return {
    get mode() {
      return local && writable ? 'local' : 'memory';
    },
    getItem(k) {
      if (local) {
        try {
          const v = local.getItem(k);
          // 쓰기 불가 상태에서 메모리에 더 새 값이 있으면 그 값을 씁니다.
          if (!writable) {
            const m = memory.getItem(k) as string | null;
            if (m !== null) return m;
          }
          if (v === null) memory.removeItem(k);
          else memory.setItem(k, v);
          return v;
        } catch {
          local = undefined;
          writable = false;
        }
      }
      return memory.getItem(k) as string | null;
    },
    setItem(k, v) {
      memory.setItem(k, v);
      if (!local) return;
      if (trySet(k, v)) {
        writable = true;
        return;
      }
      // 옛 스냅숏 제거 + 공간 확보 후 재시도
      tryRemove(k);
      if (trySet(k, v)) {
        writable = true;
        return;
      }
      writable = false;
    },
    removeItem(k) {
      memory.removeItem(k);
      tryRemove(k);
    },
  };
}
