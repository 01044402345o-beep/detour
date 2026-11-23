/**
 * PWA 클라이언트 상태 (T3.1).
 * - 서비스 워커 등록(프로덕션 빌드에서만, 앱 시작 시 1회)
 * - offlineReady: 이 페이지를 워커가 제어 중이고, 활성 워커에 프리캐시 목록 확인을 요청해 전부 캐시됐을
 *   때만 true → 설정 화면 표시
 * - needRefresh: 새 버전 워커가 설치되어 대기 중 → 업데이트 토스트
 * - applyUpdate(): 대기 워커에 SKIP_WAITING → 제어권이 넘어가면 새로고침(vite-plugin-pwa 기본 동작)
 */
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { create } from 'zustand';
import { canPersist } from './canPersist';
import { isPrecacheComplete, MSG_PRECACHE_STATUS, type PrecacheStatus } from './messages';

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
  /** 활성 워커의 프리캐시 상태 (못 받으면 null) */
  readStatus: () => Promise<PrecacheStatus | null>;
  /** 워커 제어권 변경 구독 */
  onControllerChange: (cb: () => void) => void;
};

const STATUS_TIMEOUT_MS = 5000;

function waitActivated(sw: ServiceWorker): Promise<void> {
  if (sw.state === 'activated') return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (sw.state === 'activated' || sw.state === 'redundant') {
        sw.removeEventListener('statechange', onChange);
        resolve();
      }
    };
    sw.addEventListener('statechange', onChange);
  });
}

async function readStatusFromWorker(): Promise<PrecacheStatus | null> {
  const reg = await navigator.serviceWorker.ready;
  const sw = reg.active;
  if (!sw) return null;
  await waitActivated(sw);
  // 이 페이지를 아직 워커가 맡지 않았으면 판정 보류 — 제어권이 넘어오면(controllerchange) 다시 확인합니다.
  if (!navigator.serviceWorker.controller) return null;
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), STATUS_TIMEOUT_MS);
    ch.port1.onmessage = (e: MessageEvent<PrecacheStatus>) => {
      clearTimeout(timer);
      resolve(e.data);
    };
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
};

let started = false;
let updateSW: UpdateFn | null = null;
let deps: PwaDeps = defaultPwaDeps;

/** 프리캐시 상태를 다시 확인해 offlineReady를 갱신합니다 */
export async function refreshOfflineReady(): Promise<boolean> {
  const status = await deps.readStatus().catch(() => null);
  // 응답을 못 받으면(시간 초과 등) 이전 판정을 그대로 둡니다. 받은 상태로만 참·거짓을 바꿉니다.
  if (!status) return usePwaStore.getState().offlineReady;
  const ready = isPrecacheComplete(status);
  usePwaStore.setState({ precache: status, offlineReady: ready });
  return ready;
}

/** 서비스 워커 등록 (여러 번 불러도 1회만). 개발 서버·테스트(jsdom)에서는 아무것도 하지 않습니다. */
export function startPwa(custom?: PwaDeps): void {
  if (started) return;
  started = true;
  if (custom) deps = custom;
  if (!deps.enabled()) return;

  deps.onControllerChange(() => void refreshOfflineReady());
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
  deps = defaultPwaDeps;
  usePwaStore.setState({ ...INITIAL });
}
