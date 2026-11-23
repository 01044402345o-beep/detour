/**
 * PWA 클라이언트 상태 (T3.1).
 * - 서비스 워커 등록(프로덕션 빌드에서만, 앱 시작 시 1회)
 * - offlineReady: 이 페이지를 워커가 제어 중이고, 활성 워커에 프리캐시 목록 확인을 요청해 전부 캐시됐을
 *   때만 true → 설정 화면 표시. 판정 시점을 놓치지 않도록(T3.1 R2, Phase 3 E2E 1회 실패) 여러 경로로 다시 확인합니다:
 *   등록 완료·onOfflineReady·controllerchange·워커 활성화 메시지·설정 화면 진입 + 준비될 때까지 간격 재확인.
 *   확인은 한 번에 하나만 돌고(겹치면 끝난 뒤 한 번 더), 각 확인에는 전체 시간 제한이 있어 멈춰도 다음 확인이 막히지 않습니다.
 * - needRefresh: 새 버전 워커가 설치되어 대기 중 → 업데이트 토스트
 * - applyUpdate(): 대기 워커에 SKIP_WAITING → 제어권이 넘어가면 새로고침(vite-plugin-pwa 기본 동작)
 */
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { create } from 'zustand';
import { canPersist } from './canPersist';
import {
  isPrecacheComplete,
  MSG_PRECACHE_STATUS,
  MSG_WORKER_ACTIVATED,
  type PrecacheStatus,
} from './messages';

export type PwaState = {
  offlineReady: boolean;
  needRefresh: boolean;
  /** 마지막으로 받은 프리캐시 상태 (진단·E2E 용) */
  precache: PrecacheStatus | null;
};

const INITIAL: PwaState = { offlineReady: false, needRefresh: false, precache: null };

export const usePwaStore = create<PwaState>()(() => ({ ...INITIAL }));

type UpdateFn = (reloadPage?: boolean) => Promise<void>;

export type PwaDeps = {
  /** 서비스 워커를 쓸 수 있는 환경인가 (프로덕션 빌드 + 브라우저 지원) */
  enabled: () => boolean;
  /** virtual:pwa-register의 registerSW */
  register: (opts: RegisterSWOptions) => Promise<UpdateFn>;
  /**
   * 활성 워커의 프리캐시 상태 (못 받으면 null).
   * signal: 판정 시간 제한(CHECK_TIMEOUT_MS)이 지나면 abort — 만료된 판정은 이후 요청을 보내지 않고 정리합니다 (R5-L01)
   */
  readStatus: (signal?: AbortSignal) => Promise<PrecacheStatus | null>;
  /** 워커 제어권 변경 구독 */
  onControllerChange: (cb: () => void) => void;
  /** 워커 → 페이지 메시지 구독 (활성화 알림) */
  onWorkerMessage?: (cb: (data: unknown) => void) => void;
};

const STATUS_TIMEOUT_MS = 5000;
/** 한 번의 판정 전체(ready 대기·활성화 대기·응답 대기) 시간 제한 */
export const CHECK_TIMEOUT_MS = 8000;
/** 준비될 때까지 다시 확인하는 간격(ms). 마지막 값을 반복하며, 최대 RETRY_MAX회 */
export const RETRY_DELAYS_MS = [1000, 2000, 3000, 5000] as const;
export const RETRY_MAX = 60;

/** 활성화(또는 폐기)까지 기다립니다. 취소되면 리스너를 지우고 바로 끝냅니다 */
function waitActivated(sw: ServiceWorker, signal?: AbortSignal): Promise<void> {
  if (sw.state === 'activated' || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      sw.removeEventListener('statechange', onChange);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const onChange = () => {
      if (sw.state === 'activated' || sw.state === 'redundant') done();
    };
    sw.addEventListener('statechange', onChange);
    signal?.addEventListener('abort', done);
  });
}

/**
 * 활성 워커에 프리캐시 상태를 묻습니다. signal이 취소되면(판정 시간 제한 만료)
 * ready·활성화 대기 뒤에도 요청(postMessage)을 보내지 않고, 응답 대기 중이면 포트·타이머를 정리하고 끝냅니다.
 */
export async function readStatusFromWorker(signal?: AbortSignal): Promise<PrecacheStatus | null> {
  const reg = await navigator.serviceWorker.ready;
  if (signal?.aborted) return null;
  const sw = reg.active;
  if (!sw) return null;
  await waitActivated(sw, signal);
  if (signal?.aborted) return null;
  // 이 페이지를 아직 워커가 맡지 않았으면 판정 보류 — 제어권이 넘어오면(controllerchange) 다시 확인합니다.
  if (!navigator.serviceWorker.controller) return null;
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const finish = (v: PrecacheStatus | null) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      ch.port1.onmessage = null;
      ch.port1.close();
      resolve(v);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), STATUS_TIMEOUT_MS);
    ch.port1.onmessage = (e: MessageEvent<PrecacheStatus>) => finish(e.data);
    signal?.addEventListener('abort', onAbort);
    sw.postMessage({ type: MSG_PRECACHE_STATUS }, [ch.port2]);
  });
}

export const defaultPwaDeps: PwaDeps = {
  enabled: () =>
    import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  register: async (opts) => {
    const { registerSW } = await import('virtual:pwa-register');
    return registerSW(opts);
  },
  readStatus: readStatusFromWorker,
  onControllerChange: (cb) => navigator.serviceWorker.addEventListener('controllerchange', cb),
  onWorkerMessage: (cb) =>
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => cb(e.data)),
};

let started = false;
let updateSW: UpdateFn | null = null;
let deps: PwaDeps = defaultPwaDeps;

let enabledRun = false;
let inFlight: Promise<boolean> | null = null;
let rerun = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

/** ms 안에 끝나지 않으면 null로 끝내고 onTimeout(취소 신호)을 부릅니다 */
function withTimeout<T>(p: Promise<T>, ms: number, onTimeout?: () => void): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      onTimeout?.();
      resolve(null);
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });
}

async function checkOnce(): Promise<boolean> {
  // 시간 제한이 지나면 이 판정을 취소 — 나중에 ready가 와도 만료된 판정은 요청을 보내지 않습니다 (R5-L01)
  const ac = new AbortController();
  const status = await withTimeout(deps.readStatus(ac.signal), CHECK_TIMEOUT_MS, () => ac.abort());
  // 응답을 못 받으면(제어 전·시간 초과 등) 이전 판정을 그대로 둡니다. 받은 상태로만 참·거짓을 바꿉니다.
  if (!status) return usePwaStore.getState().offlineReady;
  const ready = isPrecacheComplete(status);
  usePwaStore.setState({ precache: status, offlineReady: ready });
  return ready;
}

function clearRetry(): void {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
}

/** 아직 준비 전이면 다음 확인을 예약합니다 (이미 예약돼 있으면 그대로) */
function scheduleRetry(): void {
  if (!enabledRun || usePwaStore.getState().offlineReady) return clearRetry();
  if (retryTimer !== null || retryCount >= RETRY_MAX) return;
  const delay = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
  retryCount += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void refreshOfflineReady();
  }, delay);
}

/**
 * 프리캐시 상태를 다시 확인해 offlineReady를 갱신합니다.
 * 확인은 한 번에 하나만 돕니다 — 도는 중에 다시 불리면 끝난 뒤 한 번 더 확인하므로(최신 상태 반영),
 * 늦게 도착한 옛 응답이 새 판정을 덮어쓰는 일이 없습니다. 끝나고도 준비 전이면 재확인을 예약합니다.
 */
export function refreshOfflineReady(): Promise<boolean> {
  if (inFlight) {
    rerun = true;
    return inFlight;
  }
  inFlight = (async () => {
    let ready: boolean;
    do {
      rerun = false;
      ready = await checkOnce();
    } while (rerun);
    return ready;
  })().finally(() => {
    inFlight = null;
    scheduleRetry();
  });
  return inFlight;
}

/**
 * 설정 화면 진입 등 "지금 판정이 보여야 하는" 시점에 부릅니다.
 * 준비 전이면 즉시 다시 확인하고, 재확인 횟수를 초기화해 간격 재확인을 다시 시작합니다.
 */
export function ensureOfflineCheck(): void {
  if (!enabledRun || usePwaStore.getState().offlineReady) return;
  retryCount = 0;
  clearRetry();
  void refreshOfflineReady();
}

/** 서비스 워커 등록 (여러 번 불러도 1회만). 개발 서버·테스트(jsdom)에서는 아무것도 하지 않습니다. */
export function startPwa(custom?: PwaDeps): void {
  if (started) return;
  started = true;
  if (custom) deps = custom;
  if (!deps.enabled()) return;
  enabledRun = true;

  deps.onControllerChange(() => void refreshOfflineReady());
  deps.onWorkerMessage?.((data) => {
    if ((data as { type?: unknown } | null)?.type === MSG_WORKER_ACTIVATED)
      void refreshOfflineReady();
  });
  void deps
    .register({
      immediate: true,
      onNeedRefresh: () => usePwaStore.setState({ needRefresh: true }),
      onOfflineReady: () => void refreshOfflineReady(),
      onRegisteredSW: () => void refreshOfflineReady(),
      onRegisterError: (e: unknown) => console.warn('[pwa] service worker registration failed', e),
    })
    .then((fn) => {
      updateSW = fn;
    });
  // 등록 콜백이 오기 전이라도(또는 오지 않아도) 간격 재확인으로 판정합니다
  void refreshOfflineReady();
}

/**
 * 업데이트 토스트의 '업데이트': 새 워커로 교체 후 새로고침.
 * 영속 저장이 안 되는 상태(store가 메모리에만 저장)면 새로고침으로 주문·기록이 사라지므로
 * 교체·새로고침을 하지 않고 토스트만 닫습니다. 대기 중인 새 워커는 다음에 앱을 다시 열 때 적용됩니다 (R1 M-01).
 */
export async function applyUpdate(): Promise<void> {
  usePwaStore.setState({ needRefresh: false });
  if (!canPersist()) return;
  await updateSW?.(true);
}

/** 업데이트 토스트의 '나중에' */
export function dismissUpdate(): void {
  usePwaStore.setState({ needRefresh: false });
}

/** 테스트 전용: 모듈 상태 초기화 */
export function resetPwaForTest(): void {
  started = false;
  updateSW = null;
  enabledRun = false;
  inFlight = null;
  rerun = false;
  clearRetry();
  retryCount = 0;
  deps = defaultPwaDeps;
  usePwaStore.setState({ ...INITIAL });
}
