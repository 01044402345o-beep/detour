/** scripts/lockDir.mjs 타입 (테스트에서 import) */
import type nodeFs from 'node:fs';

export type LockFs = Pick<
  typeof nodeFs,
  'mkdirSync' | 'writeFileSync' | 'readFileSync' | 'statSync' | 'renameSync' | 'rmSync'
>;

export type LockOwner = { token: string; pid: number; time: string };
export type LockSeen = { owner: LockOwner | null; mtimeMs: number };

export type LockOptions = {
  fs?: LockFs;
  now?: () => number;
  sleep?: (ms: number) => void;
  pid?: number;
  timeoutMs?: number;
  retryMs?: number;
};

export const LOCK_DEFAULTS: { timeoutMs: number; staleMs: number; retryMs: number };
export function sleepSync(ms: number): void;
export function pidAlive(pid: number): boolean;
export function inspectLock(lock: string, fs?: LockFs): LockSeen | null;
export function releaseLock(lock: string, token: string, fs?: LockFs): boolean;
export function breakLock(
  lock: string,
  opts?: { fs?: LockFs; now?: () => number; isAlive?: (pid: number) => boolean; staleMs?: number },
): { result: 'none' | 'removed' | 'alive' | 'fresh-unknown'; owner: LockOwner | null };
export class LockTimeoutError extends Error {
  code: 'ELOCKTIMEOUT';
}
export function acquireLock(
  lock: string,
  opts?: LockOptions,
): { token: string; release: () => boolean };
