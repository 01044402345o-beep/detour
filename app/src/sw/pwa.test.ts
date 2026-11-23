import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { MSG_WORKER_ACTIVATED, type PrecacheStatus } from './messages';
import {
  applyUpdate,
  CHECK_TIMEOUT_MS,
  dismissUpdate,
  ensureOfflineCheck,
  RETRY_DELAYS_MS,
  RETRY_MAX,
  readStatusFromWorker,
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
    expect(usePwaStore.getState().offlineReady).toBe(false);
    f.controllerChange();
    await flush();
    expect(usePwaStore.getState().offlineReady).toBe(true);
  });

  it('onOfflineReady 콜백도 재확인을 일으킴', async () => {
    const f = fakeDeps([null, { total: 2, cached: 2 }]);
    startPwa(f.deps);
    await flush();
    expect(usePwaStore.getState().offlineReady).toBe(false);
    f.opts().onOfflineReady?.();
    await flush();
    expect(usePwaStore.getState().offlineReady).toBe(true);
  });

  it('응답을 못 받으면(null·오류) 이전 판정 유지', async () => {
    const f = fakeDeps([{ total: 3, cached: 3 }, null]);
    startPwa(f.deps);
    await flush();
    expect(usePwaStore.getState().offlineReady).toBe(true);
    await refreshOfflineReady();
    expect(usePwaStore.getState().offlineReady).toBe(true);
    f.readStatus.mockRejectedValueOnce(new Error('timeout'));
    await expect(refreshOfflineReady()).resolves.toBe(true);
  });
});

/**
 * 이벤트 순서가 뒤바뀌거나 빠지는 경우 (T3.1 R2 — Phase 3 E2E에서 '오프라인 준비 완료'가 끝내 안 뜬 1회 실패).
 * 실제 워커처럼 "제어 여부·캐시된 개수" 상태를 두고, 판정은 그 상태를 읽어 답합니다.
 */
describe('오프라인 준비 판정 — 순서 뒤바뀜·누락에도 결국 표시', () => {
  type World = { controlled: boolean; total: number; cached: number };

  function worldDeps(init: World) {
    const w: World = { ...init };
    let onCtrl: (() => void) | null = null;
    let onMsg: ((d: unknown) => void) | null = null;
    let opts: RegisterSWOptions | null = null;
    let active = 0;
    let maxActive = 0;
    const readStatus = vi.fn(async (): Promise<PrecacheStatus | null> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        await Promise.resolve();
        return w.controlled ? { total: w.total, cached: w.cached } : null;
      } finally {
        active -= 1;
      }
    });
    const deps: PwaDeps = {
      enabled: () => true,
      register: vi.fn(async (o: RegisterSWOptions) => {
        opts = o;
        return vi.fn(async () => {});
      }),
      readStatus,
      onControllerChange: (cb) => {
        onCtrl = cb;
      },
      onWorkerMessage: (cb) => {
        onMsg = cb;
      },
    };
    return {
      w,
      deps,
      readStatus,
      maxActive: () => maxActive,
      opts: () => opts as RegisterSWOptions,
      controllerChange: () => onCtrl?.(),
      workerMessage: (d: unknown) => onMsg?.(d),
    };
  }

  const ready = () => usePwaStore.getState().offlineReady;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('controllerchange·등록 콜백이 모두 "제어 전"에 끝나고 이후 이벤트가 없어도 → 간격 재확인으로 표시', async () => {
    const f = worldDeps({ controlled: false, total: 52, cached: 52 });
    startPwa(f.deps);
    f.controllerChange(); // 순서 뒤바뀜: 제어권 이벤트가 먼저(아직 controller 없음)
    await vi.advanceTimersByTimeAsync(0);
    f.opts().onRegisteredSW?.('sw.js', undefined);
    f.opts().onOfflineReady?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(ready()).toBe(false);
    f.w.controlled = true; // 이제 제어 중인데 알려 주는 이벤트가 더 오지 않음
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1]);
    expect(ready()).toBe(true);
  });

  it('프리캐시가 덜 찬 상태에서 이벤트가 다 지나가도 → 다 차면 재확인으로 표시', async () => {
    const f = worldDeps({ controlled: true, total: 52, cached: 10 });
    startPwa(f.deps);
    f.opts().onRegisteredSW?.('sw.js', undefined);
    f.controllerChange();
    await vi.advanceTimersByTimeAsync(0);
    expect(ready()).toBe(false);
    expect(usePwaStore.getState().precache).toEqual({ total: 52, cached: 10 });
    f.w.cached = 52;
    await vi.advanceTimersByTimeAsync(5000);
    expect(ready()).toBe(true);
  });

  it('판정 도중 새 이벤트 → 한 번에 하나만 돌고, 끝난 뒤 최신 상태로 다시 판정 (늦은 옛 응답이 덮어쓰지 않음)', async () => {
    const f = worldDeps({ controlled: true, total: 52, cached: 51 });
    let release: () => void = () => {};
    // 첫 판정은 51/52를 읽은 채 늦게 도착
    f.readStatus.mockImplementationOnce(
      () =>
        new Promise((res) => {
          release = () => res({ total: 52, cached: 51 });
        }),
    );
    startPwa(f.deps);
    await vi.advanceTimersByTimeAsync(0);
    f.w.cached = 52;
    f.controllerChange();
    f.workerMessage({ type: MSG_WORKER_ACTIVATED });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.readStatus).toHaveBeenCalledTimes(1); // 겹쳐 돌지 않음
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(ready()).toBe(true);
    expect(f.readStatus).toHaveBeenCalledTimes(2);
    expect(f.maxActive()).toBe(1);
  });

  it('판정 응답이 멈춰도(무응답) 시간 제한 뒤 재확인으로 표시', async () => {
    const f = worldDeps({ controlled: true, total: 52, cached: 52 });
    f.readStatus.mockImplementationOnce(() => new Promise(() => {})); // 영원히 대기
    startPwa(f.deps);
    await vi.advanceTimersByTimeAsync(0);
    f.opts().onRegisteredSW?.('sw.js', undefined); // 멈춘 판정 뒤로 밀림
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS - 1);
    expect(ready()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(ready()).toBe(true);
  });

  it('워커 활성화 메시지 → 즉시 재확인 (다른 메시지는 무시)', async () => {
    const f = worldDeps({ controlled: false, total: 52, cached: 52 });
    startPwa(f.deps);
    await vi.advanceTimersByTimeAsync(0);
    const calls = f.readStatus.mock.calls.length;
    f.w.controlled = true;
    f.workerMessage({ type: 'OTHER' });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.readStatus.mock.calls.length).toBe(calls);
    f.workerMessage({ type: MSG_WORKER_ACTIVATED });
    await vi.advanceTimersByTimeAsync(0);
    expect(ready()).toBe(true);
  });

  it('준비되면 재확인을 멈춤', async () => {
    const f = worldDeps({ controlled: true, total: 52, cached: 52 });
    startPwa(f.deps);
    await vi.advanceTimersByTimeAsync(0);
    expect(ready()).toBe(true);
    const calls = f.readStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.readStatus.mock.calls.length).toBe(calls);
  });

  it('재확인 상한을 넘겨 멈춘 뒤에도 설정 화면 진입(ensureOfflineCheck)으로 다시 판정', async () => {
    const f = worldDeps({ controlled: false, total: 52, cached: 52 });
    startPwa(f.deps);
    await vi.advanceTimersByTimeAsync(RETRY_MAX * 5000 + 10_000);
    const calls = f.readStatus.mock.calls.length;
    expect(calls).toBe(RETRY_MAX + 1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.readStatus.mock.calls.length).toBe(calls); // 멈춤
    f.w.controlled = true;
    ensureOfflineCheck();
    await vi.advanceTimersByTimeAsync(0);
    expect(ready()).toBe(true);
  });

  it('서비스 워커를 쓸 수 없는 환경에서는 ensureOfflineCheck가 아무것도 하지 않음', async () => {
    const f = worldDeps({ controlled: true, total: 52, cached: 52 });
    startPwa({ ...f.deps, enabled: () => false });
    ensureOfflineCheck();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f.readStatus).not.toHaveBeenCalled();
    expect(ready()).toBe(false);
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

/**
 * R5-L01: 시간 제한으로 만료된 판정은 나중에 ready가 와도 요청(postMessage)을 보내지 않고,
 * statechange 리스너·MessagePort를 남기지 않음. 실제 readStatusFromWorker 경로를 씁니다.
 */
describe('만료된 판정의 후속 요청 차단 (readStatusFromWorker + AbortSignal)', () => {
  type Listener = () => void;

  function setup() {
    let releaseReady: () => void = () => {};
    const listeners = new Set<Listener>();
    const added = vi.fn();
    const removed = vi.fn();
    const sw = {
      state: 'activating' as ServiceWorkerState,
      addEventListener: (type: string, cb: Listener) => {
        if (type !== 'statechange') return;
        added();
        listeners.add(cb);
      },
      removeEventListener: (type: string, cb: Listener) => {
        if (type !== 'statechange') return;
        removed();
        listeners.delete(cb);
      },
      postMessage: vi.fn((_msg: unknown, ports: Array<{ postMessage: (d: unknown) => void }>) => {
        ports[0].postMessage({ total: 52, cached: 52 });
      }),
    };
    const ready = new Promise((res) => {
      releaseReady = () => res({ active: sw });
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready, controller: {} },
    });
    const closed = vi.fn();
    class FakeChannel {
      port1: { onmessage: ((e: { data: unknown }) => void) | null; close: () => void } = {
        onmessage: null,
        close: closed,
      };
      port2 = { postMessage: (d: unknown) => this.port1.onmessage?.({ data: d }) };
    }
    vi.stubGlobal('MessageChannel', FakeChannel);
    const activate = () => {
      sw.state = 'activated';
      [...listeners].forEach((cb) => cb());
    };
    return { sw, releaseReady, activate, added, removed, closed, listeners };
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('ready를 40초 보류 후 해제 → 요청은 현재 판정 1건뿐, 52/52면 준비 완료, 리스너·포트 정리', async () => {
    const env = setup();
    startPwa({
      enabled: () => true,
      register: async () => async () => {},
      readStatus: readStatusFromWorker,
      onControllerChange: () => {},
    });
    // 그동안 판정 여러 번이 8초 제한으로 만료됨 (0~8, 9~17, 19~27, 30~38초)
    await vi.advanceTimersByTimeAsync(40_000);
    expect(usePwaStore.getState().offlineReady).toBe(false);
    env.releaseReady();
    await vi.advanceTimersByTimeAsync(0);
    // 만료된 판정들은 ready 직후 끝남 — 활성화 대기 리스너도, 요청도 없음
    expect(env.added).not.toHaveBeenCalled();
    expect(env.sw.postMessage).not.toHaveBeenCalled();
    // 다음 재확인(43초)이 현재 판정 — 활성화를 기다림
    await vi.advanceTimersByTimeAsync(5_000);
    expect(env.added).toHaveBeenCalledTimes(1);
    env.activate();
    await vi.advanceTimersByTimeAsync(0);
    expect(env.sw.postMessage).toHaveBeenCalledTimes(1);
    expect(usePwaStore.getState().offlineReady).toBe(true);
    expect(env.removed).toHaveBeenCalledTimes(env.added.mock.calls.length);
    expect(env.listeners.size).toBe(0);
    expect(env.closed).toHaveBeenCalledTimes(1);
  });

  it('응답 대기 중에 취소되면 포트를 닫고 null', async () => {
    const env = setup();
    env.sw.state = 'activated';
    env.sw.postMessage.mockImplementation(() => {}); // 응답 없음
    env.releaseReady();
    const ac = new AbortController();
    const p = readStatusFromWorker(ac.signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(env.sw.postMessage).toHaveBeenCalledTimes(1);
    ac.abort();
    await expect(p).resolves.toBeNull();
    expect(env.closed).toHaveBeenCalledTimes(1);
  });
});
