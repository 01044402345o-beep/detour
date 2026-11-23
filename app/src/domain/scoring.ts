/**
 * 채점 모듈 (T1.4, PRD F-09).
 * 목표 문장과 음성 인식 결과를 정규화한 뒤 한글 자모 단위 편집거리로 '인식 일치도'(0~100)를 매깁니다.
 * 발음 정확도를 단정하는 점수가 아닙니다.
 */
import type { ScoreResult, WordMatch } from '../types';
import { toNative, toSino } from './numerals';

// ───────── 정규화 ─────────

/** 숫자 뒤 단위 → 수사 종류 (task.md T1.4: 개·공기·명 → 고유어, 인분 → 한자어) */
const UNIT_KIND: Record<string, 'native' | 'sino'> = {
  공기: 'native',
  개: 'native',
  명: 'native',
  인분: 'sino',
};
const UNIT_SRC = '(공기|인분|개|명)';
/** 토큰 안: 숫자 + (공백) + 단위 */
const NUM_UNIT_RE = new RegExp(`(\\d+)(\\s*)${UNIT_SRC}`, 'g');
/** 토큰 끝 숫자 (다음 토큰이 단위로 시작할 때) */
const TRAILING_NUM_RE = /(\d+)$/;
const LEADING_UNIT_RE = new RegExp(`^${UNIT_SRC}`);
/** 문자·숫자가 아닌 것(공백·문장부호·기호) */
const NON_WORD_RE = /[^\p{L}\p{N}]/gu;

/** 1~9만 수사로 바꿉니다(PRD F-06 수량 범위). 범위 밖이면 숫자를 그대로 둡니다. */
function numeral(digits: string, unit: string): string {
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 1 || n > 9 || digits.length !== 1) return digits;
  return UNIT_KIND[unit] === 'sino' ? toSino(n) : toNative(n);
}

function convertNumerals(text: string): string {
  return text.replace(NUM_UNIT_RE, (_m, d: string, sp: string, unit: string) => `${numeral(d, unit)}${sp}${unit}`);
}

/** 정규화된 단어(토큰). ko는 문장부호만 뺀 원래 표기 */
type Token = { ko: string; norm: string };

/**
 * NFC 통일 → 공백 기준 분리 → 토큰마다 문장부호 제거(빈 토큰은 버림) → 숫자→수사 → 소문자화.
 * 문장부호를 먼저 지워야 '2, 개'·'2-개' 같은 입력도 수사로 바뀝니다 (T1.4 R1-01·02).
 */
export function tokenize(text: string): Token[] {
  const raw = text
    .normalize('NFC')
    .split(/\s+/)
    .map((t) => t.replace(NON_WORD_RE, ''))
    .filter(Boolean);
  return raw.map((tok, i) => {
    let conv = convertNumerals(tok);
    // '2 개'처럼 숫자와 단위가 다른 토큰에 나뉜 경우
    const next = raw[i + 1];
    const unit = next?.match(LEADING_UNIT_RE)?.[1];
    if (unit) conv = conv.replace(TRAILING_NUM_RE, (d) => numeral(d, unit));
    return { ko: tok, norm: conv.toLowerCase() };
  });
}

/** 비교용 정규화: 공백·문장부호 제거, 숫자 → 한글 수사, 소문자화 */
export function normalize(text: string): string {
  return tokenize(text)
    .map((t) => t.norm)
    .join('');
}

// ───────── 자모 분해 ─────────

const SYL_BASE = 0xac00;
const SYL_LAST = 0xd7a3;

/** 한글 음절 → 초성·중성·(종성) 자모. 한글이 아닌 문자는 그대로 한 단위 */
export function decompose(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= SYL_BASE && code <= SYL_LAST) {
      const idx = code - SYL_BASE;
      const l = Math.floor(idx / 588);
      const v = Math.floor((idx % 588) / 28);
      const t = idx % 28;
      out.push(String.fromCharCode(0x1100 + l), String.fromCharCode(0x1161 + v));
      if (t > 0) out.push(String.fromCharCode(0x11a7 + t));
    } else {
      out.push(ch);
    }
  }
  return out;
}

// ───────── 편집거리 ─────────

/** 레벤슈타인 거리 (삽입·삭제·치환 비용 1) */
export function levenshtein(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * 정규화된 두 문자열의 인식 일치도.
 * round(100 × (1 − 거리 / max(목표 자모 수, 인식 자모 수))), 하한 0. 둘 다 비면 100.
 */
export function similarity(targetNorm: string, heardNorm: string): number {
  const a = decompose(targetNorm);
  const b = decompose(heardNorm);
  const max = Math.max(a.length, b.length);
  if (max === 0) return 100;
  return Math.max(0, Math.round(100 * (1 - levenshtein(a, b) / max)));
}

// ───────── 단어 정렬 ─────────

/**
 * 목표 음절열과 인식 음절열을 음절 단위로 정렬합니다.
 * 치환 비용은 두 음절의 자모 거리 비율(0~1)이라 비슷한 음절끼리 짝지어집니다.
 * 반환: 인식 음절마다 대응하는 목표 음절 위치(삽입이면 직전 목표 위치, 맨 앞 삽입이면 0).
 */
function alignHeardToTarget(target: string[], heard: string[]): number[] {
  const n = target.length;
  const m = heard.length;
  const sub = (i: number, j: number) => 1 - similarity(target[i], heard[j]) / 100;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub(i - 1, j - 1));
    }
  }
  const owner = new Array<number>(m).fill(0);
  let i = n;
  let j = m;
  const EPS = 1e-9;
  while (j > 0) {
    if (i > 0 && Math.abs(d[i][j] - (d[i - 1][j - 1] + sub(i - 1, j - 1))) < EPS) {
      owner[j - 1] = i - 1;
      i--;
      j--;
    } else if (i > 0 && Math.abs(d[i][j] - (d[i - 1][j] + 1)) < EPS) {
      i--;
    } else {
      owner[j - 1] = Math.max(0, i - 1);
      j--;
    }
  }
  return owner;
}

// ───────── 채점 ─────────

/**
 * 목표 문장과 인식 결과를 채점합니다 (PRD F-09).
 * 인식 결과가 정규화 후 비면 0점 대신 { status: 'empty' }.
 */
export function scoreSpeech(target: string, heard: string): ScoreResult {
  const heardNorm = normalize(heard);
  if (!heardNorm) return { status: 'empty' };

  const tokens = tokenize(target);
  const targetNorm = tokens.map((t) => t.norm).join('');
  const score = similarity(targetNorm, heardNorm);

  // 목표 음절 → 단어 인덱스
  const targetSyl = [...targetNorm];
  const sylWord: number[] = [];
  tokens.forEach((t, w) => {
    for (let k = 0; k < [...t.norm].length; k++) sylWord.push(w);
  });

  const heardSyl = [...heardNorm];
  const owner = targetSyl.length ? alignHeardToTarget(targetSyl, heardSyl) : [];
  const heardPerWord = tokens.map(() => '');
  owner.forEach((tIdx, j) => {
    heardPerWord[sylWord[tIdx]] += heardSyl[j];
  });

  const words: WordMatch[] = tokens.map((t, w) => {
    const h = heardPerWord[w];
    const s = h ? similarity(t.norm, h) : 0;
    // 일치 판정은 반올림 점수가 아니라 정규화 문자열 동등으로 (T1.4 R1-03)
    return { ko: t.ko, heard: h || null, matched: h === t.norm, score: s };
  });

  let weakestIndex: number | null = null;
  words.forEach((w, idx) => {
    if (w.matched) return;
    if (weakestIndex === null || w.score < words[weakestIndex].score) weakestIndex = idx;
  });

  return { status: 'scored', score, words, weakestIndex };
}
