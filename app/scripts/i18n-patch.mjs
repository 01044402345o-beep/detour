#!/usr/bin/env node
/**
 * 번역 패치 적용 (task.md Phase 6 번역 파일 규칙, T6.0).
 *
 *   node app/scripts/i18n-patch.mjs <패치.json> [<패치2.json> ...] [--dir <i18n 폴더>] [--check] [--lock-timeout <ms>]
 *   node app/scripts/i18n-patch.mjs --break-lock [--dir <i18n 폴더>]   (남은 잠금 수동 정리, coordinator 전용)
 *
 * 패치 형식: { "en": {중첩 키}, "ja": {...}, "zh": {...}, "$override": ["nav.me", ...] }
 *  - 세 언어 모두 있어야 하고, 세 언어의 잎 키 집합이 같아야 합니다.
 *  - 잎 값은 비어 있지 않은 문자열.
 *  - 이미 있는 키에 같은 값 → 통과(멱등). 다른 값 → 오류로 멈춤(충돌).
 *    의도적으로 값을 바꿀 키만 "$override"에 점 경로로 적습니다(세 언어 공통). 그 키는 제자리에서 값만 바뀝니다.
 *  - 기존 키 순서는 그대로, 새 키는 해당 객체의 끝에 붙습니다.
 *
 * 동작: 잠금(<dir>/.patch.lock, scripts/lockDir.mjs: 소유 토큰, 자동 회수 없음, 100ms 간격 대기·
 * 기본 최대 30초 `--lock-timeout <ms>`) 안에서
 * en/ja/zh를 읽고 → 모든 패치를 메모리에서 병합(하나라도 오류면 아무것도 쓰지 않음) →
 * 바뀐 파일만 각각 임시 파일에 쓴 뒤 연달아 rename. 파일 형식(2칸 들여쓰기, 줄바꿈 CRLF/LF, 끝 줄바꿈)은 기존 파일을 따릅니다.
 * --check: 쓰지 않고 적용 결과가 지금 파일과 같은지만 확인(다르면 종료 코드 1).
 * 오류 종료 코드: 2 = 잘못된 패치/사용법, 3 = 충돌, 4 = 잠금 시간 초과(남은 잠금: 소유 PID·시각 안내),
 *   5 = --break-lock 거부(소유 PID가 살아 있음 또는 만드는 중인 잠금).
 * --break-lock: 다른 패치 작업이 없을 때 coordinator가 남은 잠금을 지우는 수동 명령. 소유 PID가 죽었을 때만 지움.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCK_DEFAULTS, acquireLock, breakLock, sleepSync } from './lockDir.mjs';

export const LANGS = ['en', 'ja', 'zh'];

export class PatchError extends Error {
  constructor(message, code = 2) {
    super(message);
    this.code = code;
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** 중첩 객체 → 잎 점 경로 목록 (잎이 문자열이 아니면 오류) */
function leafPaths(obj, where, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.includes('.')) throw new PatchError(`${where}: key "${k}" must not contain "."`);
    const p = prefix ? `${prefix}.${k}` : k;
    if (isObj(v)) {
      if (Object.keys(v).length === 0) throw new PatchError(`${where}: empty object at ${p}`);
      out.push(...leafPaths(v, where, p));
    } else if (typeof v === 'string') {
      if (v.trim() === '') throw new PatchError(`${where}: empty string at ${p}`);
      out.push(p);
    } else {
      throw new PatchError(`${where}: value at ${p} must be a string or object`);
    }
  }
  return out;
}

/** 패치 모양 검사. 통과하면 { langs, override:Set } */
export function validatePatch(patch, name = 'patch') {
  if (!isObj(patch)) throw new PatchError(`${name}: top level must be an object`);
  for (const k of Object.keys(patch)) {
    if (!LANGS.includes(k) && k !== '$override')
      throw new PatchError(`${name}: unknown top-level key "${k}"`);
  }
  const keySets = {};
  for (const lang of LANGS) {
    if (!isObj(patch[lang])) throw new PatchError(`${name}: "${lang}" must be an object`);
    keySets[lang] = leafPaths(patch[lang], `${name}.${lang}`).sort();
  }
  for (const lang of LANGS.slice(1)) {
    if (JSON.stringify(keySets[lang]) !== JSON.stringify(keySets.en)) {
      const a = new Set(keySets.en);
      const b = new Set(keySets[lang]);
      const diff = [...a].filter((x) => !b.has(x)).concat([...b].filter((x) => !a.has(x)));
      throw new PatchError(`${name}: en and ${lang} key sets differ: ${diff.join(', ')}`);
    }
  }
  const override = patch.$override ?? [];
  if (!Array.isArray(override) || override.some((x) => typeof x !== 'string' || !x))
    throw new PatchError(`${name}: "$override" must be an array of dotted key paths`);
  const leaves = new Set(keySets.en);
  for (const p of override) {
    if (!leaves.has(p))
      throw new PatchError(`${name}: $override "${p}" is not a key in this patch`);
  }
  return { override: new Set(override) };
}

/** target에 src를 깊게 병합(제자리). 충돌이면 PatchError(code 3) */
function mergeInto(target, src, override, where, prefix = '') {
  for (const [k, v] of Object.entries(src)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const has = Object.prototype.hasOwnProperty.call(target, k);
    if (isObj(v)) {
      if (!has) target[k] = {};
      else if (!isObj(target[k]))
        throw new PatchError(`${where}: conflict at ${p} (existing string, patch object)`, 3);
      mergeInto(target[k], v, override, where, p);
    } else if (!has) {
      target[k] = v;
    } else if (isObj(target[k])) {
      throw new PatchError(`${where}: conflict at ${p} (existing object, patch string)`, 3);
    } else if (target[k] !== v) {
      if (!override.has(p))
        throw new PatchError(
          `${where}: conflict at ${p}: existing ${JSON.stringify(target[k])} vs patch ${JSON.stringify(v)} (add "${p}" to "$override" to change it on purpose)`,
          3,
        );
      target[k] = v; // 제자리에서 값만 바뀜 → 키 순서 유지
    }
  }
}

/** 메모리 병합: dicts = { en: obj, ja: obj, zh: obj } (제자리 변경) */
export function mergePatches(dicts, patches) {
  for (const { name, patch } of patches) {
    const { override } = validatePatch(patch, name);
    for (const lang of LANGS) mergeInto(dicts[lang], patch[lang], override, `${name}.${lang}`);
  }
  return dicts;
}

function serialize(obj, raw) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const body = JSON.stringify(obj, null, 2).replace(/\n/g, eol);
  return /\r?\n$/.test(raw) ? body + eol : body;
}

/**
 * 파일에 적용. patchFiles = 패치 파일 경로 목록.
 * 반환: { changed: ['en', ...], wouldChange (check 모드) }
 */
export function applyPatchFiles(
  patchFiles,
  { dir, check = false, lockTimeoutMs = LOCK_DEFAULTS.timeoutMs, holdMs = 0 } = {},
) {
  if (patchFiles.length === 0) throw new PatchError('usage: i18n-patch.mjs <patch.json> [...]');
  const patches = patchFiles.map((f) => {
    let patch;
    try {
      patch = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
      throw new PatchError(`${f}: cannot read JSON (${e.message})`);
    }
    return { name: path.basename(f), patch };
  });
  // 파일을 건드리기 전에 모양부터 검사
  for (const { name, patch } of patches) validatePatch(patch, name);

  // --check는 읽기만 하므로 잠금을 잡지 않음. (테스트 러너가 --check 도중 자식 프로세스를 끊으면
  // 잠금이 남아 다른 worker를 막던 문제, Phase 6 병렬 묶음에서 2회 관찰)
  let lock = null;
  if (!check) {
    try {
      lock = acquireLock(path.join(dir, '.patch.lock'), { timeoutMs: lockTimeoutMs });
    } catch (e) {
      if (e.code === 'ELOCKTIMEOUT') throw new PatchError(e.message, 4);
      throw e;
    }
  }
  try {
    const raw = {};
    const dicts = {};
    for (const lang of LANGS) {
      raw[lang] = fs.readFileSync(path.join(dir, `${lang}.json`), 'utf8');
      dicts[lang] = JSON.parse(raw[lang]);
    }
    if (holdMs > 0) sleepSync(holdMs); // 테스트용: 읽은 뒤 잠금을 쥔 채 기다림(동시 적용 경쟁 재현)
    mergePatches(dicts, patches);
    const next = {};
    const changed = LANGS.filter((lang) => {
      next[lang] = serialize(dicts[lang], raw[lang]);
      return next[lang] !== raw[lang];
    });
    if (check) return { changed };
    const tmps = changed.map((lang) => {
      const file = path.join(dir, `${lang}.json`);
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, next[lang]);
      return { tmp, file };
    });
    for (const { tmp, file } of tmps) fs.renameSync(tmp, file);
    return { changed };
  } finally {
    try {
      if (lock && !lock.release())
        console.error('i18n-patch: warning: lock was no longer ours at release');
    } catch (e) {
      console.error(`i18n-patch: warning: could not release lock (${e.code ?? e.message})`);
    }
  }
}

function main(argv) {
  const files = [];
  let dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n');
  let check = false;
  let breakIt = false;
  let lockTimeoutMs = LOCK_DEFAULTS.timeoutMs;
  const holdMs = Number(process.env.I18N_PATCH_TEST_HOLD_MS ?? 0) || 0;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') dir = path.resolve(argv[++i] ?? '');
    else if (argv[i] === '--check') check = true;
    else if (argv[i] === '--break-lock') breakIt = true;
    else if (argv[i] === '--lock-timeout') lockTimeoutMs = Number(argv[++i]);
    else files.push(path.resolve(argv[i]));
  }
  if (breakIt) {
    if (files.length) {
      console.error('i18n-patch: --break-lock takes no patch files');
      process.exit(2);
    }
    try {
      const { result, owner } = breakLock(path.join(dir, '.patch.lock'));
      const who = owner ? `pid ${owner.pid} since ${owner.time}` : 'unknown owner';
      if (result === 'none') console.log('no lock');
      else if (result === 'removed') console.log(`removed stale lock (${who})`);
      else {
        console.error(
          result === 'alive'
            ? `i18n-patch: refused: lock owner ${who} is still running`
            : 'i18n-patch: refused: lock has no owner yet and is less than 60s old (it may be being created)',
        );
        process.exit(5);
      }
    } catch (e) {
      console.error(`i18n-patch: could not remove lock (${e.code ?? ''} ${e.message})`);
      process.exit(1);
    }
    return;
  }
  try {
    if (!Number.isFinite(lockTimeoutMs) || lockTimeoutMs < 0)
      throw new PatchError('--lock-timeout needs a number of milliseconds');
    const { changed } = applyPatchFiles(files, { dir, check, lockTimeoutMs, holdMs });
    if (check) {
      if (changed.length) {
        console.error(`not applied yet: ${changed.join(', ')}`);
        process.exit(1);
      }
      console.log('up to date');
    } else {
      console.log(
        changed.length ? `updated: ${changed.join(', ')}` : 'no changes (already applied)',
      );
    }
  } catch (e) {
    console.error(`i18n-patch: ${e.message}`);
    process.exit(e instanceof PatchError ? e.code : 1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
