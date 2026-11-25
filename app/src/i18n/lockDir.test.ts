// @vitest-environment node
/**
 * 번역 패치 잠금(scripts/lockDir.mjs) 검사 — T6.0 R1-M-01·M-02, R2-M-01(자동 회수 없음).
 * 실제 임시 폴더 + 오류를 끼워 넣거나 호출을 세는 fs 래퍼, 가짜 시계로 순서를 결정적으로 재현합니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  acquireLock,
  breakLock,
  inspectLock,
  releaseLock,
  type LockFs,
} from '../../scripts/lockDir.mjs';

let dir: string;
let lock: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lockdir-'));
  lock = path.join(dir, '.patch.lock');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** 가짜 시계: sleep만큼 시간이 흐름 */
function clock() {
  const c = { t: Date.now(), sleeps: 0 };
  return {
    c,
    now: () => c.t,
    sleep: (ms: number) => {
      c.t += ms;
      c.sleeps += 1;
    },
  };
}

function err(code: string) {
  return Object.assign(new Error(`${code}: injected`), { code });
}

const FS_FNS = [
  'mkdirSync',
  'writeFileSync',
  'readFileSync',
  'statSync',
  'renameSync',
  'rmSync',
] as const;

/** 호출 수를 세고, 지정한 함수가 오류를 던지게 하는 래퍼 (times: 몇 번, Infinity = 계속) */
function wrapped(fail?: { name: keyof LockFs; code: string; times?: number }) {
  const counts: Record<string, number> = {};
  const out = {} as LockFs;
  for (const k of FS_FNS) {
    counts[k] = 0;
    (out as Record<string, unknown>)[k] = (...args: unknown[]) => {
      counts[k] += 1;
      if (fail && k === fail.name && counts[k] <= (fail.times ?? Infinity)) throw err(fail.code);
      return (fs[k] as (...a: unknown[]) => unknown)(...args);
    };
  }
  return { fs: out, counts };
}

function plantLock(owner: { token: string; pid: number } | null, ageMs = 0) {
  fs.mkdirSync(lock);
  if (owner) fs.writeFileSync(path.join(lock, 'owner'), JSON.stringify({ ...owner, time: 'T0' }));
  if (ageMs) {
    const t = new Date(Date.now() - ageMs);
    fs.utimesSync(lock, t, t);
  }
}

const tokenNow = () => inspectLock(lock)?.owner?.token;

type LockErr = Omit<Error, 'cause'> & { code?: string; cause?: { code?: string } };

function timeoutError(fn: () => unknown): LockErr {
  try {
    fn();
  } catch (e) {
    return e as LockErr;
  }
  throw new Error('expected a lock timeout');
}

describe('획득·해제', () => {
  it('owner에 토큰·PID를 쓰고, 자기 토큰일 때만 해제', () => {
    const a = acquireLock(lock);
    expect(tokenNow()).toBe(a.token);
    expect(inspectLock(lock)?.owner?.pid).toBe(process.pid);
    expect(releaseLock(lock, 'someone-else')).toBe(false);
    expect(fs.existsSync(lock)).toBe(true);
    expect(a.release()).toBe(true);
    expect(fs.existsSync(lock)).toBe(false);
    expect(a.release()).toBe(false); // 두 번째 해제는 아무것도 안 함
  });

  it('잡혀 있던 잠금이 풀리면 이어서 획득', () => {
    plantLock({ token: 'other', pid: process.pid });
    const k = clock();
    const sleep = (ms: number) => {
      k.sleep(ms);
      if (k.c.sleeps === 3) fs.rmSync(lock, { recursive: true }); // 다른 프로세스가 해제
    };
    const a = acquireLock(lock, { timeoutMs: 5000, now: k.now, sleep });
    expect(tokenNow()).toBe(a.token);
    expect(k.c.sleeps).toBe(3);
  });
});

describe('자동 회수 없음 (R2-M-01): 남은 잠금은 기다렸다가 종료 코드 4 안내', () => {
  const cases = [
    { name: '살아 있는 소유자(오래됨)', owner: { token: 'live', pid: process.pid }, age: 600_000 },
    { name: '죽은 소유자', owner: { token: 'dead', pid: 999_999 }, age: 600_000 },
    { name: 'owner 없는 오래된 잠금', owner: null, age: 600_000 },
  ];
  for (const c of cases) {
    it(`${c.name}: 지우거나 옮기지 않고 deadline까지 대기 후 시간 초과`, () => {
      plantLock(c.owner, c.age);
      const k = clock();
      const w = wrapped();
      const e = timeoutError(() =>
        acquireLock(lock, { fs: w.fs, timeoutMs: 1000, retryMs: 100, now: k.now, sleep: k.sleep }),
      );
      expect(e.code).toBe('ELOCKTIMEOUT');
      expect(e.message).toMatch(/--break-lock/);
      if (c.owner) expect(e.message).toContain(`pid ${c.owner.pid} since T0`);
      else expect(e.message).toMatch(/unknown owner/);
      expect(w.counts.renameSync).toBe(0);
      expect(w.counts.rmSync).toBe(0);
      expect(k.c.sleeps).toBe(11); // 100ms 간격으로 기다림(바쁜 반복 아님)
      expect(inspectLock(lock)?.owner?.token).toBe(c.owner?.token);
    });
  }

  it('이전 소유자의 늦은 해제는 새 소유자의 잠금을 지우지 않음', () => {
    const a = acquireLock(lock);
    // A가 비정상 종료한 것으로 보고 coordinator가 정리한 뒤 B가 획득
    expect(breakLock(lock, { isAlive: () => false }).result).toBe('removed');
    const b = acquireLock(lock, { timeoutMs: 5000 });
    expect(a.release()).toBe(false);
    expect(tokenNow()).toBe(b.token);
    expect(b.release()).toBe(true);
  });
});

describe('breakLock (수동 정리)', () => {
  it('잠금이 없으면 none', () => {
    expect(breakLock(lock).result).toBe('none');
  });

  it('소유 PID가 살아 있으면 거부하고 그대로 둠', () => {
    plantLock({ token: 'live', pid: process.pid }, 600_000);
    const r = breakLock(lock);
    expect(r.result).toBe('alive');
    expect(r.owner?.pid).toBe(process.pid);
    expect(tokenNow()).toBe('live');
  });

  it('소유 PID가 죽었으면 지움', () => {
    plantLock({ token: 'dead', pid: 999_999 });
    expect(breakLock(lock, { isAlive: () => false }).result).toBe('removed');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('owner 없는 잠금: 새것이면 거부, 60초 지나면 지움', () => {
    plantLock(null);
    expect(breakLock(lock).result).toBe('fresh-unknown');
    expect(fs.existsSync(lock)).toBe(true);
    fs.rmSync(lock, { recursive: true });
    plantLock(null, 120_000);
    expect(breakLock(lock).result).toBe('removed');
  });
});

describe('오류는 제한 시간 안에서 쉬며 재시도 (R1-M-02)', () => {
  for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
    it(`mkdir ${code}가 계속되면 시간 초과(원인 보존), 매 반복 대기`, () => {
      const k = clock();
      const w = wrapped({ name: 'mkdirSync', code });
      const e = timeoutError(() =>
        acquireLock(lock, { fs: w.fs, timeoutMs: 1000, retryMs: 100, now: k.now, sleep: k.sleep }),
      );
      expect(e.code).toBe('ELOCKTIMEOUT');
      expect(e.message).toContain(code);
      expect(e.cause?.code).toBe(code);
      expect(w.counts.mkdirSync).toBe(11);
      expect(k.c.sleeps).toBe(11);
    });
  }

  it('잠금 상태 읽기(stat) EPERM이 계속되면 시간 초과(원인 보존)', () => {
    plantLock({ token: 'x', pid: process.pid });
    const k = clock();
    const w = wrapped({ name: 'statSync', code: 'EPERM' });
    const e = timeoutError(() =>
      acquireLock(lock, { fs: w.fs, timeoutMs: 500, now: k.now, sleep: k.sleep }),
    );
    expect(e.cause?.code).toBe('EPERM');
    expect(k.c.sleeps).toBe(6);
  });

  it('일시적인 오류 뒤에는 획득', () => {
    const k = clock();
    const w = wrapped({ name: 'mkdirSync', code: 'EBUSY', times: 2 });
    const a = acquireLock(lock, { fs: w.fs, timeoutMs: 1000, now: k.now, sleep: k.sleep });
    expect(tokenNow()).toBe(a.token);
    expect(k.c.sleeps).toBe(2);
  });

  it('경쟁으로 사라진 잠금(ENOENT)은 쉬지 않고 바로 다시 시도', () => {
    plantLock({ token: 'gone', pid: process.pid });
    const k = clock();
    const w = wrapped();
    let first = true;
    w.fs.statSync = ((p: fs.PathLike) => {
      if (first && String(p) === lock) {
        first = false;
        fs.rmSync(lock, { recursive: true }); // 다른 프로세스가 막 해제함
        throw err('ENOENT');
      }
      return fs.statSync(p);
    }) as LockFs['statSync'];
    const a = acquireLock(lock, { fs: w.fs, timeoutMs: 1000, now: k.now, sleep: k.sleep });
    expect(tokenNow()).toBe(a.token);
    expect(k.c.sleeps).toBe(0);
  });

  it('timeoutMs 0이고 계속 실패해도 끝남', () => {
    const k = clock();
    const w = wrapped({ name: 'mkdirSync', code: 'EPERM' });
    expect(
      timeoutError(() => acquireLock(lock, { fs: w.fs, timeoutMs: 0, now: k.now, sleep: k.sleep }))
        .code,
    ).toBe('ELOCKTIMEOUT');
    expect(w.counts.mkdirSync).toBe(1);
  });
});
