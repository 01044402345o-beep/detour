import type { SttFailureReason, SttState } from './types';

/** 공유 계약 SttState: 미지원 + 6개 실패 상태 모두에서 showStaff 호출 가능 (T0.2 M-01) */
describe('SttState 계약', () => {
  it('미지원은 showStaff만, 실패 상태는 retry·showStaff', () => {
    const calls: string[] = [];
    const showStaff = () => calls.push('staff');
    const retry = () => calls.push('retry');

    const reasons: SttFailureReason[] = [
      'denied',
      'no-speech',
      'timeout',
      'network',
      'aborted',
      'error',
    ];
    const states: SttState[] = [
      { status: 'unsupported', actions: { showStaff } },
      ...reasons.map((status): SttState => ({ status, actions: { retry, showStaff } })),
    ];

    for (const s of states) {
      if (s.status === 'unsupported') {
        s.actions.showStaff();
        // @ts-expect-error 미지원 상태에는 retry가 없다
        void s.actions.retry;
      } else if ('actions' in s) {
        s.actions.showStaff();
        s.actions.retry();
      }
    }
    expect(calls.filter((c) => c === 'staff')).toHaveLength(7);
    expect(calls.filter((c) => c === 'retry')).toHaveLength(6);
  });
});
