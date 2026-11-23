import { afterEach, describe, expect, it, vi } from 'vitest';
import { findHardcoded } from './hardcodeCheck';
import { formatKo, OPERATOR_KO } from './operatorKo';

describe('OPERATOR_KO (S13 운영자 리포트 한국어 고정)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('모든 값이 비어 있지 않은 한국어 문자열이다', () => {
    for (const [key, value] of Object.entries(OPERATOR_KO)) {
      expect(value.trim(), key).not.toBe('');
      expect(value, key).toMatch(/\p{Script=Hangul}/u);
    }
  });

  it('필수 문구가 있다 (예시 데이터 명시 F-16, 내 기기 기록 분리 F-16a)', () => {
    expect(OPERATOR_KO.sampleBadge).toBe('예시 데이터 · 시연용');
    expect(OPERATOR_KO.title).toBe('운영자 리포트 — 원도심');
    expect(OPERATOR_KO.deviceNote).toMatch(/합산하지 않/);
  });

  it('formatKo가 자리표시자를 채운다', () => {
    expect(formatKo('kpiReportsPending', { count: 3 })).toBe('확인 대기 3건');
    expect(formatKo('hourLabel', { h: 14 })).toBe('14시');
    expect(formatKo('title')).toBe('운영자 리포트 — 원도심');
  });

  it('formatKo에 params가 빠지면 자리표시자를 남기고 경고한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(formatKo('deviceEvents')).toBe('이용 기록 {count}건');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing param "count"'));
  });

  it('하드코딩 검사: OPERATOR_KO 사용은 통과, 직접 쓴 한국어는 위반', () => {
    const file = 'src/screens/OperatorReport.tsx';
    expect(findHardcoded('const A = () => <h1>{OPERATOR_KO.title}</h1>;', file)).toEqual([]);
    expect(findHardcoded("const A = () => <h1>{'운영자 리포트 — 원도심'}</h1>;", file)).toEqual([]);
    expect(
      findHardcoded('const A = () => <h1>운영자 리포트</h1>;', file).map((v) => v.text),
    ).toEqual(['운영자 리포트']);
  });
});
