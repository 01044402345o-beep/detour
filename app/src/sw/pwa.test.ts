import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import type { PrecacheStatus } from './messages';
import {
  applyUpdate,
  dismissUpdate,
  refreshOfflineReady,
  resetPwaForTest,
  startPwa,
  usePwaStore,
  type PwaDeps,
} from './pwa';

function fakeDeps(statuses: Array<PrecacheStatus | null>, enabled = true) {
  const queue = [...statuses];
  const update = vi.fn(async () => {});
  let opts: RegisterSWOptions | null = null;
  let onCtrl: (() => void) | null = null;
  const readStatus = vi.fn(async (): Promise<PrecacheStatus | null> =>
    queue.length > 1 ? (queue.shift() ?? null) : (queue[0] ?? null),
  );
  const register = vi.fn(async (o: RegisterSWOptions) => {
    opts = o;
    return update;
  });
  const deps: PwaDeps = {
    enabled: () => enabled,
    register,
    readStatus,
    onControllerChange: (cb) => {
      onCtrl = cb;
    },
  };
  return {
    deps,
    register,
    readStatus,
    update,
    opts: () => opts as RegisterSWOptions,
    controllerChange: () => onCtrl?.(),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => resetPwaForTest());

describe('startPwa — 등록', () => {
  it('지원하지 않는 환경(개발 서버·jsdom)에서는 등록하지 않음', () => {
    const f = fakeDeps([], false);
    startPwa(f.deps);
    expect(f.register).not.toHaveBeenCalled();
  });

  it('여러 번 불러도 1회만 등록, immediate 등록', async () => {
    const f = fakeDeps([{ total: 3, cached: 3 }]);
    startPwa(f.deps);
    startPwa(f.deps);
    await flush();
    expect(f.register).toHaveBeenCalledTimes(1);
    expect(f.opts().immediate).toBe(true);
  });
});

describe('오프라인 준비 완료', () => {
  it('등록 후 프리캐시가 전부 캐시됐으면 offlineReady', async () => {
    const f = fakeDeps([{ total: 3, cached: 3 }]);
    startPwa(f.deps);
    await flush();
    f.opts().onRegisteredSW?.('sw.js', undefined);
    await flush();
    expect(usePwaStore.getState().offlineReady).toBe(true);
    expect(usePwaStore.getState().precache).toEqual({ total: 3, cached: 3 });
  });

  it('일부만 캐시됐으면 표시하지 않고, 다 차면 표시 (controllerchange 재확인)', async () => {
    const f = fakeDeps([
      { total: 3, cached: 1 },
      { total: 3, cached: 3 },
    ]);
    startPwa(f.deps);
    await flush();
    f.opts().onRegisteredSW?.('sw.js', undefined);
    await flush();
    expect(usePwaStore.getState().offlineReady).toBe(false);
    f.controllerChange();
    await flush();
    expect(usePwaStore.getState().offlineReady).toBe(true);
  });

  it('onOfflineReady 콜백도 재확인을 일으킴', async () => {
    const f = fakeDeps([{ total: 2, cached: 2 }]);
    startPwa(f.deps);
    await flush();
    f.opts().onOfflineReady?.();
    await flush();
    expect(usePwaStore.getState().offlineReady).toBe(true);
  });

  it('응답을 못 받으면(null·오류) 이전 판정 유지', async () => {
    const f = fakeDeps([{ total: 3, cached: 3 }, null]);
    startPwa(f.deps);
    await flush();
    await refreshOfflineReady();
    expect(usePwaStore.getState().offlineReady).toBe(true);
    await refreshOfflineReady();
    expect(usePwaStore.getState().offlineReady).toBe(true);
    f.readStatus.mockRejectedValueOnce(new Error('timeout'));
    await expect(refreshOfflineReady()).resolves.toBe(true);
  });
});

describe('업데이트', () => {
  it('새 워커 대기 → needRefresh, 업데이트 → updateSW(true) 호출 후 토스트 닫힘', async () => {
    const f = fakeDeps([]);
    startPwa(f.deps);
    await flush();
    f.opts().onNeedRefresh?.();
    expect(usePwaStore.getState().needRefresh).toBe(true);
    await applyUpdate();
    expect(f.update).toHaveBeenCalledWith(true);
    expect(usePwaStore.getState().needRefresh).toBe(false);
  });

  it('영속 저장 불가(localStorage setItem 예외) → updateSW 호출 없이 토스트만 닫음 (R1 M-01)', async () => {
    const f = fakeDeps([]);
    startPwa(f.deps);
    await flush();
    f.opts().onNeedRefresh?.();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    try {
      await applyUpdate();
    } finally {
      spy.mockRestore();
    }
    expect(f.update).not.toHaveBeenCalled();
    expect(usePwaStore.getState().needRefresh).toBe(false);
  });

  it('나중에 → 토스트만 닫고 교체하지 않음', async () => {
    const f = fakeDeps([]);
    startPwa(f.deps);
    await flush();
    f.opts().onNeedRefresh?.();
    dismissUpdate();
    expect(usePwaStore.getState().needRefresh).toBe(false);
    expect(f.update).not.toHaveBeenCalled();
  });
});
