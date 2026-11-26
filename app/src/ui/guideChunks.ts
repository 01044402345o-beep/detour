/**
 * 음성 가이드 원고를 '한 번에 보여 줄 묶음'으로 나눔 (T6.17, 사용자 요청: 2문장씩 보여 주고 다 읽으면 다음 2문장).
 * - 문단 안에서 앞에서부터 2문장씩 묶습니다(문단을 넘어 묶지 않음 → 문단이 홀수면 마지막 문장은 혼자).
 * - 두 문장을 합친 길이가 언어별 상한을 넘으면 1문장만 (팝업 칸이 너무 커지지 않게).
 *   상한은 휴대폰 폭(약 350px, 16px 글자)에서 4~5줄 안쪽이 되도록 정한 값입니다.
 * 결과: 묶음마다 원고 전체(문단을 이어 붙인) 문장 번호 목록.
 */
import type { Lang } from '../types';

export const GUIDE_CHUNK_MAX: Readonly<Record<Lang, number>> = { en: 170, ja: 80, zh: 70 };

export type GuideChunks = {
  /** 묶음별 문장 번호 (각 1~2개) */
  chunks: number[][];
  /** 문장 번호 → 묶음 번호 */
  chunkOf: number[];
};

export function chunkGuide(paragraphs: readonly (readonly string[])[], max: number): GuideChunks {
  const chunks: number[][] = [];
  const chunkOf: number[] = [];
  let i = 0;
  for (const p of paragraphs) {
    let k = 0;
    while (k < p.length) {
      const pair = k + 1 < p.length && p[k].length + p[k + 1].length <= max;
      const c = pair ? [i, i + 1] : [i];
      for (const n of c) chunkOf[n] = chunks.length;
      chunks.push(c);
      i += c.length;
      k += c.length;
    }
  }
  return { chunks, chunkOf };
}
