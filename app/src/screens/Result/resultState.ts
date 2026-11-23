/**
 * 채점 결과(S07) 입력 상태 (T2.4).
 * 연습 화면이 scoreSpeech 결과를 router state로 넘깁니다. 인식 원문(transcript)과 단어별 인식 조각
 * (WordMatch.heard)은 넣지 않습니다 — 음성 인식 결과를 저장하지 않는다는 안내(F-08)를 지키기 위해
 * 점수·목표 단어·일치 여부만 남깁니다.
 */
import { tokenize } from '../../domain/scoring';
import type { ScoreResult } from '../../types';
import { parsePracticeNav, type PracticeNav } from '../Practice/practiceSession';

export type ResultWord = { ko: string; matched: boolean };

export type ResultState = {
  nav: PracticeNav;
  /** 인식 일치도 0~100 */
  score: number;
  words: ResultWord[];
  weakestIndex: number | null;
};

type Scored = Extract<ScoreResult, { status: 'scored' }>;

/**
 * 채점 토큰(공백 단위)을 S06 학습 단위(문장 words, 예: '두 개')로 묶습니다 (R1 L-01).
 * 단위마다 tokenize(unit).length개 토큰을 순서대로 차지합니다(텍스트 검색 없음 — '주세요'·'개' 반복).
 * 단위 토큰 수의 합이 채점 토큰 수와 다르면 null → 토큰 단위로 표시.
 */
export function groupByUnits(
  r: Scored,
  units: readonly string[],
): { words: ResultWord[]; weakestIndex: number | null } | null {
  const sizes = units.map((u) => tokenize(u).length);
  const total = sizes.reduce((a, n) => a + n, 0);
  if (units.length === 0 || sizes.some((n) => n === 0) || total !== r.words.length) return null;
  const words: ResultWord[] = [];
  let weakestIndex: number | null = null;
  let start = 0;
  units.forEach((ko, i) => {
    const end = start + sizes[i];
    const span = r.words.slice(start, end);
    if (r.weakestIndex !== null && r.weakestIndex >= start && r.weakestIndex < end)
      weakestIndex = i;
    words.push({ ko, matched: span.every((w) => w.matched) });
    start = end;
  });
  return { words, weakestIndex };
}

/**
 * @param units S06에서 보여 준 학습 단위(item.words의 ko). 생략하거나 맞지 않으면 채점 토큰 그대로
 */
export function toResultState(nav: PracticeNav, r: Scored, units?: readonly string[]): ResultState {
  const grouped = units ? groupByUnits(r, units) : null;
  if (units && !grouped && import.meta.env.DEV) {
    console.warn('[result] word units do not match scoring tokens', units);
  }
  return {
    nav,
    score: r.score,
    ...(grouped ?? {
      words: r.words.map((w) => ({ ko: w.ko, matched: w.matched })),
      weakestIndex: r.weakestIndex,
    }),
  };
}

/** 형식이 틀리면 null (바로 열기·새로고침·조작된 state) */
export function parseResultState(state: unknown): ResultState | null {
  if (!state || typeof state !== 'object') return null;
  const s = state as Record<string, unknown>;
  const nav = parsePracticeNav(s.nav);
  if (!nav) return null;
  const { score, words, weakestIndex } = s;
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100)
    return null;
  if (!Array.isArray(words) || words.length === 0) return null;
  const clean: ResultWord[] = [];
  for (const w of words) {
    if (!w || typeof w !== 'object') return null;
    const { ko, matched } = w as Record<string, unknown>;
    if (typeof ko !== 'string' || !ko || typeof matched !== 'boolean') return null;
    clean.push({ ko, matched });
  }
  let weak: number | null = null;
  if (weakestIndex !== null) {
    if (
      typeof weakestIndex !== 'number' ||
      !Number.isInteger(weakestIndex) ||
      weakestIndex < 0 ||
      weakestIndex >= clean.length ||
      clean[weakestIndex].matched
    )
      return null;
    weak = weakestIndex;
  }
  return { nav, score, words: clean, weakestIndex: weak };
}

/** 목업 S07: 85점 이상이면 '잘했어요'(초록 링), 아니면 '거의 다 왔어요'(노란 링) */
export const GOOD_SCORE = 85;
