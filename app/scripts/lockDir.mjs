/**
 * 디렉터리 잠금 (scripts/i18n-patch.mjs가 씀, T6.0 R1-M-01·M-02, R2-M-01).
 *
 * 획득: mkdir(lock) 성공 = 소유. 곧바로 lock/owner에 {token, pid, time}을 씁니다.
 * 이미 있으면 **자동으로 회수하지 않습니다**(소유 PID가 살아 있든 죽었든). retryMs 간격으로 기다리다
 * deadline을 넘으면 code 'ELOCKTIMEOUT' 오류(소유 PID·시각과 `--break-lock` 안내 포함)로 끝납니다.
 * 해제: owner 토큰이 자기 것일 때만 지움.
 * 남은 잠금 정리: breakLock() — 사람이(coordinator, 다른 작업이 없을 때) 부르는 수동 명령.
 *  소유 PID가 살아 있으면 거부. owner가 없는 잠금은 staleMs가 지났을 때만 지움.
 * 오류: 경쟁으로 사라진 경로(ENOENT)는 바로 다시 시도, 그 밖의 오류(EPERM·EACCES·EBUSY 등)는 원인을 기억하고
 *  retryMs 쉬었다 다시 시도. 모든 반복 경로에서 deadline을 검사.
 */
import { randomUUID } from 'node:crypto';
import nodeFs from 'node:fs';
import path from 'node:path';

export const LOCK_DEFAULTS = { timeoutMs: 30_000, staleMs: 60_000, retryMs: 100 };

export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** PID가 살아 있는지 (권한이 없어 신호를 못 보내도 살아 있는 것으로 봄) */
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

const ownerFile = (lock) => path.join(lock, 'owner');

/** 잠금 상태: 없으면 null, owner를 못 읽으면 owner:null */
export function inspectLock(lock, fs = nodeFs) {
  let mtimeMs;
  try {
    mtimeMs = fs.statSync(lock).mtimeMs;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  let owner = null;
  try {
    const o = JSON.parse(fs.readFileSync(ownerFile(lock), 'utf8'));
    if (o && typeof o.token === 'string') owner = o;
  } catch (e) {
    if (e.code && e.code !== 'ENOENT') throw e; // JSON 오류(쓰는 중)는 owner 없음으로
  }
  return { owner, mtimeMs };
}

function removeDir(fs, dir, tag) {
  const grave = `${dir}.gone-${tag}-${randomUUID()}`;
  fs.renameSync(dir, grave);
  fs.rmSync(grave, { recursive: true, force: true });
}

/** 자기 토큰일 때만 해제. 돌려준 값: 해제했는지 */
export function releaseLock(lock, token, fs = nodeFs) {
  const cur = inspectLock(lock, fs);
  if (!cur || cur.owner?.token !== token) return false;
  removeDir(fs, lock, 'release');
  return true;
}

/**
 * 남은 잠금 수동 정리. 반환 { result, owner }
 *  - 'none': 잠금 없음
 *  - 'removed': 지움 (소유 PID가 죽었거나, owner 없는 잠금이 staleMs 지남)
 *  - 'alive': 소유 PID가 살아 있어 거부
 *  - 'fresh-unknown': owner 없는 잠금이 아직 새것이라 거부(만드는 중일 수 있음)
 */
export function breakLock(lock, opts = {}) {
  const { fs = nodeFs, now = Date.now, isAlive = pidAlive, staleMs = LOCK_DEFAULTS.staleMs } = opts;
  const cur = inspectLock(lock, fs);
  if (!cur) return { result: 'none', owner: null };
  if (cur.owner) {
    if (isAlive(cur.owner.pid)) return { result: 'alive', owner: cur.owner };
  } else if (now() - cur.mtimeMs <= staleMs) {
    return { result: 'fresh-unknown', owner: null };
  }
  removeDir(fs, lock, 'broken');
  return { result: 'removed', owner: cur.owner };
}

export class LockTimeoutError extends Error {
  constructor(message, cause) {
    super(message, cause ? { cause } : undefined);
    this.code = 'ELOCKTIMEOUT';
  }
}

/**
 * 잠금 획득. 반환 { token, release() }.
 * opts: timeoutMs·retryMs, 테스트용 fs·now·sleep·pid
 */
export function acquireLock(lock, opts = {}) {
  const {
    fs = nodeFs,
    now = Date.now,
    sleep = sleepSync,
    pid = process.pid,
    timeoutMs = LOCK_DEFAULTS.timeoutMs,
    retryMs = LOCK_DEFAULTS.retryMs,
  } = opts;
  const token = `${pid}-${now()}-${randomUUID()}`;
  const deadline = now() + timeoutMs;
  let lastError = null;
  let held = null; // 마지막으로 본 잠금 상태

  for (;;) {
    if (now() > deadline) {
      let why;
      if (lastError) why = `last error ${lastError.code ?? ''} ${lastError.message}`;
      else if (held)
        why = held.owner
          ? `held by pid ${held.owner.pid} since ${held.owner.time}`
          : `held by an unknown owner since ${new Date(held.mtimeMs).toISOString()}`;
      else why = 'held by another process';
      throw new LockTimeoutError(
        `lock timeout after ${timeoutMs}ms: ${lock} (${why}). ` +
          'If no other patch is running, remove it with --break-lock (refused while the owner pid is alive).',
        lastError ?? undefined,
      );
    }
    try {
      fs.mkdirSync(lock);
    } catch (e) {
      if (e.code === 'EEXIST') {
        try {
          held = inspectLock(lock, fs);
          if (!held) continue; // 그 사이 해제됨 → 바로 다시
          lastError = null;
        } catch (e2) {
          if (e2.code === 'ENOENT') continue;
          lastError = e2;
        }
      } else {
        lastError = e;
      }
      sleep(retryMs);
      continue;
    }
    try {
      fs.writeFileSync(
        ownerFile(lock),
        JSON.stringify({ token, pid, time: new Date(now()).toISOString() }),
      );
    } catch (e) {
      // 소유 표시를 못 쓴 잠금은 내려놓고 다시 시도 (방금 만든 자기 폴더)
      try {
        fs.rmSync(lock, { recursive: true, force: true });
      } catch {
        /* 남으면 --break-lock으로 정리 */
      }
      lastError = e;
      sleep(retryMs);
      continue;
    }
    return { token, release: () => releaseLock(lock, token, fs) };
  }
}
