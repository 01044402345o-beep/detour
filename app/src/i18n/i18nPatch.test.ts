// @vitest-environment node
/**
 * 번역 패치 스크립트(scripts/i18n-patch.mjs) 검사 (T6.0). 실제 CLI를 임시 폴더에 대고 실행합니다.
 * 세 언어 키 집합 일치는 i18n/index.test.ts '사전 키 집합'이 검사합니다.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP = process.cwd();
const SCRIPT = path.join(APP, 'scripts/i18n-patch.mjs');
const PATCH_DIR = path.join(APP, 'src/i18n/patches');

let dir: string;

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', dir, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function writeDict(lang: string, obj: unknown, eol = '\r\n') {
  fs.writeFileSync(
    path.join(dir, `${lang}.json`),
    JSON.stringify(obj, null, 2).replace(/\n/g, eol) + eol,
  );
}

const readRaw = (lang: string) => fs.readFileSync(path.join(dir, `${lang}.json`), 'utf8');
const read = (lang: string) => JSON.parse(readRaw(lang)) as Record<string, Record<string, string>>;

function patchFile(name: string, patch: unknown) {
  const f = path.join(dir, name);
  fs.writeFileSync(f, JSON.stringify(patch));
  return f;
}

const base = (v: string) => ({
  common: { back: `${v}back`, close: `${v}close` },
  nav: { me: `${v}me` },
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-patch-'));
  writeDict('en', base('E'));
  writeDict('ja', base('J'));
  writeDict('zh', base('Z'));
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('i18n-patch.mjs', () => {
  const ok = {
    en: { common: { soon: 'Soon' }, photo: { credits: 'Photo credits', deep: { a: 'A' } } },
    ja: { common: { soon: 'J soon' }, photo: { credits: 'J credits', deep: { a: 'JA' } } },
    zh: { common: { soon: 'Z soon' }, photo: { credits: 'Z credits', deep: { a: 'ZA' } } },
  };

  it('중첩 병합: 새 키는 객체 끝에, 기존 키·순서·형식(CRLF·2칸·끝 줄바꿈) 유지', () => {
    const r = run(patchFile('p.json', ok));
    expect(r.code, r.err).toBe(0);
    const en = read('en');
    expect(Object.keys(en)).toEqual(['common', 'nav', 'photo']);
    expect(Object.keys(en.common)).toEqual(['back', 'close', 'soon']);
    expect(en.common.back).toBe('Eback');
    expect(read('ja').photo).toEqual({ credits: 'J credits', deep: { a: 'JA' } });
    const raw = readRaw('zh');
    expect(raw.endsWith('}\r\n')).toBe(true);
    expect(raw).toContain('\r\n    "soon": "Z soon"\r\n');
    expect(raw.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('LF 파일은 LF로 유지', () => {
    writeDict('en', base('E'), '\n');
    expect(run(patchFile('p.json', ok)).code).toBe(0);
    expect(readRaw('en')).not.toContain('\r');
    expect(readRaw('en').endsWith('}\n')).toBe(true);
  });

  it('반복 적용해도 결과가 같음(멱등), --check 통과', () => {
    const f = patchFile('p.json', ok);
    run(f);
    const once = ['en', 'ja', 'zh'].map(readRaw);
    const r = run(f);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/no changes/);
    expect(['en', 'ja', 'zh'].map(readRaw)).toEqual(once);
    expect(run('--check', f).code).toBe(0);
  });

  it('--check는 잠금을 잡지 않음: 다른 프로세스가 잠금을 쥐고 있어도 바로 끝나고 잠금은 그대로', () => {
    const lockDir = path.join(dir, '.patch.lock');
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, 'owner'), JSON.stringify({ token: 't', pid: process.pid, time: '' }));
    const f = patchFile('p.json', ok);
    expect(run(f, '--lock-timeout', '300').code).toBe(4); // 쓰기는 잠금 때문에 기다리다 실패
    expect(run('--check', f).code).toBe(1); // 아직 적용 안 됨 → 1 (잠금 대기 없이)
    expect(fs.existsSync(lockDir)).toBe(true);
    fs.rmSync(lockDir, { recursive: true });
  });

  it('--check: 아직 적용 안 했으면 종료 코드 1, 파일은 그대로', () => {
    const before = readRaw('en');
    expect(run('--check', patchFile('p.json', ok)).code).toBe(1);
    expect(readRaw('en')).toBe(before);
  });

  it('충돌: 기존 키에 다른 값이면 종료 코드 3, 세 파일 모두 그대로', () => {
    const before = ['en', 'ja', 'zh'].map(readRaw);
    const r = run(
      patchFile('c.json', {
        en: { nav: { me: 'Settings' } },
        ja: { nav: { me: 'Jme' } },
        zh: { nav: { me: '设置' } },
      }),
    );
    expect(r.code).toBe(3);
    expect(r.err).toMatch(/conflict at nav\.me/);
    expect(['en', 'ja', 'zh'].map(readRaw)).toEqual(before);
  });

  it('충돌: 문자열 자리에 객체(또는 반대)도 오류', () => {
    const p = {
      en: { nav: { me: { x: 'a' } } },
      ja: { nav: { me: { x: 'b' } } },
      zh: { nav: { me: { x: 'c' } } },
    };
    expect(run(patchFile('c.json', p)).code).toBe(3);
  });

  it('$override: 지정한 키만 제자리에서 값 변경(순서 유지)', () => {
    const r = run(
      patchFile('o.json', {
        $override: ['nav.me'],
        en: { nav: { me: 'Settings' } },
        ja: { nav: { me: '設定' } },
        zh: { nav: { me: '设置' } },
      }),
    );
    expect(r.code, r.err).toBe(0);
    expect(read('en').nav).toEqual({ me: 'Settings' });
    expect(read('zh').nav.me).toBe('设置');
    expect(Object.keys(read('en'))).toEqual(['common', 'nav']);
  });

  it('잘못된 패치는 종료 코드 2 (JSON 아님·언어 누락·키 집합 불일치·빈 값·모르는 $override)', () => {
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{ not json');
    expect(run(bad).code).toBe(2);
    expect(run(patchFile('a.json', { en: { x: 'a' }, ja: { x: 'b' } })).code).toBe(2);
    expect(
      run(patchFile('b.json', { en: { x: 'a', y: 'b' }, ja: { x: 'b' }, zh: { x: 'c' } })).code,
    ).toBe(2);
    expect(run(patchFile('c.json', { en: { x: ' ' }, ja: { x: 'b' }, zh: { x: 'c' } })).code).toBe(
      2,
    );
    expect(
      run(patchFile('d.json', { $override: ['y'], en: { x: 'a' }, ja: { x: 'b' }, zh: { x: 'c' } }))
        .code,
    ).toBe(2);
    expect(run(patchFile('e.json', { en: { x: 1 }, ja: { x: 'b' }, zh: { x: 'c' } })).code).toBe(2);
    expect(run().code).toBe(2);
  });

  it('여러 패치를 순서대로 한 번에 적용, 하나라도 충돌이면 아무것도 쓰지 않음', () => {
    const before = readRaw('en');
    const a = patchFile('a.json', {
      en: { x: { a: 'A' } },
      ja: { x: { a: 'JA' } },
      zh: { x: { a: 'ZA' } },
    });
    const b = patchFile('b.json', {
      en: { x: { a: 'B' } },
      ja: { x: { a: 'JB' } },
      zh: { x: { a: 'ZB' } },
    });
    expect(run(a, b).code).toBe(3);
    expect(readRaw('en')).toBe(before);
  });

  it('잠금: 끝나면 잠금 폴더·임시 파일이 남지 않음', () => {
    expect(run(patchFile('p.json', ok)).code).toBe(0);
    expect(fs.existsSync(path.join(dir, '.patch.lock'))).toBe(false);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('잠금(R1-M-01): 프로세스 2개가 서로 다른 패치를 동시에 적용해도 둘 다 반영(갱신 유실 없음)', async () => {
    const pa = patchFile('a.json', {
      en: { a: { x: 'A' } },
      ja: { a: { x: 'JA' } },
      zh: { a: { x: 'ZA' } },
    });
    const pb = patchFile('b.json', {
      en: { b: { y: 'B' } },
      ja: { b: { y: 'JB' } },
      zh: { b: { y: 'ZB' } },
    });
    // 각자 사전을 읽은 뒤 잠금을 쥔 채 400ms 기다림 → 잠금이 없으면 나중에 쓴 쪽이 앞의 변경을 덮어씀
    const env = { ...process.env, I18N_PATCH_TEST_HOLD_MS: '400' };
    const go = (f: string) =>
      new Promise<{ code: number | null; err: string }>((resolve) => {
        const c = spawn(process.execPath, [SCRIPT, '--dir', dir, f], { env });
        let err = '';
        c.stderr.on('data', (d) => (err += d));
        c.on('close', (code) => resolve({ code, err }));
      });
    const t0 = Date.now();
    const [ra, rb] = await Promise.all([go(pa), go(pb)]);
    expect(ra.code, ra.err).toBe(0);
    expect(rb.code, rb.err).toBe(0);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(800); // 차례로 실행됨
    for (const lang of ['en', 'ja', 'zh']) {
      const d = read(lang) as Record<string, Record<string, string>>;
      expect(Object.keys(d)).toEqual(expect.arrayContaining(['common', 'nav', 'a', 'b']));
      expect(d.a.x).toBeTruthy();
      expect(d.b.y).toBeTruthy();
    }
    expect(fs.existsSync(path.join(dir, '.patch.lock'))).toBe(false);
  }, 20_000);

  function plant(owner: { token: string; pid: number } | null, ageMs = 0) {
    const lock = path.join(dir, '.patch.lock');
    fs.mkdirSync(lock);
    if (owner) fs.writeFileSync(path.join(lock, 'owner'), JSON.stringify({ ...owner, time: 'T0' }));
    if (ageMs) {
      const t = new Date(Date.now() - ageMs);
      fs.utimesSync(lock, t, t);
    }
    return lock;
  }

  it('잠금(R2-M-01): 살아 있는 프로세스의 잠금 → 기다렸다 종료 코드 4 안내, --break-lock은 거부(5)', () => {
    const lock = plant({ token: 'live', pid: process.pid }, 600_000);
    const before = readRaw('en');
    const r = run('--lock-timeout', '300', patchFile('p.json', ok));
    expect(r.code).toBe(4);
    expect(r.err).toContain(`pid ${process.pid} since T0`);
    expect(r.err).toMatch(/--break-lock/);
    const b = run('--break-lock');
    expect(b.code).toBe(5);
    expect(b.err).toMatch(/still running/);
    expect(JSON.parse(fs.readFileSync(path.join(lock, 'owner'), 'utf8')).token).toBe('live');
    expect(readRaw('en')).toBe(before);
  });

  it('잠금(R2-M-01): 끝난(죽은) 프로세스의 잠금도 자동으로 지우지 않음 → 4, --break-lock으로 지운 뒤 적용', () => {
    const dead = spawnSync(process.execPath, ['-e', '0']).pid;
    const lock = plant({ token: 'dead', pid: dead });
    const r = run('--lock-timeout', '300', patchFile('p.json', ok));
    expect(r.code).toBe(4);
    expect(r.err).toContain(`pid ${dead}`);
    expect(fs.existsSync(lock)).toBe(true);
    const b = run('--break-lock');
    expect(b.code, b.err).toBe(0);
    expect(b.out).toMatch(/removed stale lock/);
    expect(fs.existsSync(lock)).toBe(false);
    expect(run(patchFile('p.json', ok)).code).toBe(0);
  });

  it('--break-lock: 잠금이 없으면 0, 패치 파일과 같이 주면 2', () => {
    const b = run('--break-lock');
    expect(b.code).toBe(0);
    expect(b.out).toMatch(/no lock/);
    expect(run('--break-lock', patchFile('p.json', ok)).code).toBe(2);
  });
});

describe('저장소 패치 파일', () => {
  it('src/i18n/patches/*.json이 모두 en/ja/zh.json에 적용되어 있음 (--check)', () => {
    const files = fs
      .readdirSync(PATCH_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => path.join(PATCH_DIR, f));
    expect(files.length).toBeGreaterThan(0);
    const r = spawnSync(process.execPath, [SCRIPT, '--check', ...files], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
  });
});
