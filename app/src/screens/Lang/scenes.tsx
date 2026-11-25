/**
 * 인트로 기능 안내판의 장면 그림 3개 (T6.1, 시안 mockup/redesign/intro.html).
 * 특정 메뉴·문장 예시는 넣지 않고 추상 막대·도형으로만 그립니다. 모두 장식(aria-hidden은 부모가 겁니다).
 * still(움직임 줄이기·일시정지)이면 단계 타이머 없이 정적 마지막 모습입니다.
 * 장면 안 단계 움직임은 setTimeout 콜백에서만 상태를 바꾸고, 정리 함수에서 타이머를 지웁니다.
 */
import { useEffect, useState } from 'react';
import { cx } from '../../ui';

/** 단계 시각(ms). 단계 수 = 배열 길이 */
const ORDER_STEPS = [500, 1100, 1550, 2050] as const;
const STAFF_STEPS = [500, 1500, 2200, 2700] as const;

/**
 * active인 동안 단계를 0 → steps.length로 올림.
 * still(움직임 줄이기 또는 일시정지)이면 타이머 없이 마지막 단계(정적 모습). (R1 M-01)
 */
function useSteps(steps: readonly number[], active: boolean, still: boolean): number {
  const [step, setStep] = useState(still ? steps.length : 0);
  useEffect(() => {
    if (!active || still) return;
    const timers = steps.map((ms, i) => window.setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach((tm) => window.clearTimeout(tm));
  }, [steps, active, still]);
  return still ? steps.length : step;
}

/** ① 코스: 경로선이 그려지고 정류장 번호가 차례로 나타남 (CSS 애니메이션) */
export function CourseScene() {
  const stops = [
    { x: 92, y: 104, d: 0.55 },
    { x: 128, y: 116, d: 0.85 },
    { x: 196, y: 72, d: 1.25 },
    { x: 262, y: 52, d: 1.65 },
  ];
  return (
    <svg className="lc-svg" viewBox="0 0 320 168" focusable="false">
      <path className="lc-grid" d="M0 42H320M0 84H320M0 126H320M64 0V168M128 0V168M192 0V168M256 0V168" />
      <path className="lc-road" d="M-10 150 L120 20 M40 168 L330 96 M200 0 L240 168" />
      <path className="lc-run" d="M40 128 L92 104 L128 116 L196 72 L262 52" pathLength={360} />
      <g className="lc-pop" style={{ animationDelay: '0.1s' }}>
        <rect className="lc-start" x="27" y="118" width="26" height="20" rx="6" />
      </g>
      {stops.map((p, i) => (
        <g key={i} className="lc-pop" style={{ animationDelay: `${p.d}s` }}>
          <circle className="lc-stop" cx={p.x} cy={p.y} r="11" />
          <text className="lc-num" x={p.x} y={p.y + 4}>
            {i + 1}
          </text>
        </g>
      ))}
      <g className="lc-fade" style={{ animationDelay: '2s' }}>
        <rect className="lc-chip" x="196" y="112" width="104" height="40" rx="10" />
        <g className="lc-icon" transform="translate(206 122)">
          <circle cx="10" cy="10" r="8" />
          <path d="M10 5v5l3 2" />
        </g>
        <rect className="lc-line1" x="234" y="124" width="54" height="6" rx="3" />
        <rect className="lc-line2" x="234" y="135" width="34" height="5" rx="2.5" />
      </g>
      <g className="lc-fade" style={{ animationDelay: '1.9s' }}>
        <rect className="lc-chip" x="14" y="22" width="92" height="34" rx="10" />
        <g className="lc-icon" transform="translate(23 29)">
          <circle cx="11" cy="3.5" r="2.4" />
          <path d="M9 8l-3 6 4 3v4M9 8l4 3 3 1M10 17l-3 4" />
        </g>
        <rect className="lc-line1" x="50" y="33" width="44" height="6" rx="3" />
        <rect className="lc-line2" x="50" y="43" width="28" height="5" rx="2.5" />
      </g>
    </svg>
  );
}

function Stepper({ count, tap }: { count: number; tap: boolean }) {
  return (
    <span className="lo-step">
      <em>{'−'}</em>
      <b className={cx('num', count > 0 && 'lo-n')}>{count}</b>
      {/* tap이 바뀔 때마다 새로 그려 물결을 다시 재생 */}
      <em key={String(count)} className={cx(tap && 'lo-tap')}>
        {'+'}
      </em>
    </span>
  );
}

/** ② 주문: + 를 누르면 수량이 오르고, 한국어 주문 카드(막대)가 나타남 */
export function OrderScene({ active, still }: { active: boolean; still: boolean }) {
  const step = useSteps(ORDER_STEPS, active, still);
  const c1 = step >= 1 ? 1 : 0;
  const c2 = step >= 3 ? 2 : step >= 2 ? 1 : 0;
  return (
    <div className="lo">
      <div className="lo-rows">
        <div className="lo-row">
          <span className="lo-t"><span /><span /></span>
          <Stepper count={c1} tap={!still && step === 1} />
        </div>
        <div className="lo-row">
          <span className="lo-t"><span /><span /></span>
          <Stepper count={c2} tap={!still && (step === 2 || step === 3)} />
        </div>
        <div className="lo-row">
          <span className="lo-t"><span /><span /></span>
          <Stepper count={0} tap={false} />
        </div>
      </div>
      <div className={cx('lo-card', step >= 4 && 'is-on')}>
        <div className="lo-ko"><span /><span /></div>
        <div className="lo-ro" />
        <div className="lo-snd">
          <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
            <path d="M4 9v6h4l5 4V5L8 9z" />
          </svg>
          <span className="lo-w"><i /><i /><i /><i /></span>
        </div>
      </div>
    </div>
  );
}

/** ③ 직원: 휴대폰이 직원 쪽으로 돌고, 응답이 체크되고, 내 언어 말풍선이 나타남 */
export function StaffScene({
  active,
  still,
  turnLabel,
}: {
  active: boolean;
  still: boolean;
  turnLabel: string;
}) {
  const step = useSteps(STAFF_STEPS, active, still);
  const turned = step === 1 || step === 2;
  return (
    <div className="ls">
      <div className={cx('ls-phone', turned && 'is-turned')}>
        <small />
        <span />
        <span />
        <div className="ls-btns">
          <i className={cx(step >= 2 && 'is-yes')}>
            <svg viewBox="0 0 24 24" width="12" height="12" focusable="false">
              <path d="M5 12l5 5 9-10" />
            </svg>
          </i>
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="ls-flow">
        <div className="ls-who">
          <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
            <path d="M17 3l4 4-4 4M21 7H9a5 5 0 0 0 0 10h3" />
          </svg>
          <span>{turnLabel}</span>
        </div>
        <div className={cx('ls-bubble', step >= 4 && 'is-on')}>
          <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </svg>
          <span className="ls-lines"><span /><span /></span>
        </div>
      </div>
    </div>
  );
}
