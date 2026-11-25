/** 코스 화면 글자 도우미 (T6.3) */
import type { ReactNode } from 'react';

/**
 * 글자 타일에 쓸 한글 2~3자 (DESIGN.md 5장: 사진 없는 장소는 파랑 바탕 + 흰 한글 2~3자).
 * 첫 낱말이 3자 이하면 그대로(성심당·생일집), 길면 앞 2자(광천식당 → 광천, 홍가네풀빵 → 홍가).
 */
export function tileText(nameKo: string): string {
  const first = nameKo.trim().split(/\s+/)[0] ?? '';
  const chars = [...first];
  return chars.length <= 3 ? first : chars.slice(0, 2).join('');
}

/** 문장 속 숫자(시간·거리·개수)만 고정폭 숫자(.num)로 (DESIGN.md 1·3장) */
export function withNums(text: string): ReactNode[] {
  return text.split(/(\d+(?:\.\d+)?)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="num">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
