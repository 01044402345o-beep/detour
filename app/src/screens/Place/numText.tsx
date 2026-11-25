/**
 * 번역 문장 안의 시각·가격 치환값만 숫자 글꼴(.num, IBM Plex Mono)로 (DESIGN.md 1·3장, T6.4 R1 L-01).
 * 문장 전체는 일반 글꼴로 두고, 이미 채워진 문장에서 그 값이 나온 자리만 감쌉니다.
 */
import { Fragment, type ReactNode } from 'react';

export function NumIn({ text, value }: { text: string; value: string }): ReactNode {
  if (!value || !text.includes(value)) return text;
  const parts = text.split(value);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && <span className="num">{value}</span>}
    </Fragment>
  ));
}
