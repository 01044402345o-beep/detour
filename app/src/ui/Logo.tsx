import { cx } from './cx';

/** 타일 색: 파란 타일 + 흰 선 / 흰 바탕 + 파란 선 / 짙은 파랑 타일 + 흰 선 (DESIGN.md 4장) */
export type LogoTile = 'blue' | 'white' | 'deep';

export type LogoProps = {
  /** 타일 한 변(px). 기본 36 */
  size?: number;
  tile?: LogoTile;
  /** 글자 로고 `edulleo` + 작은 `에둘러` 표시 */
  wordmark?: boolean;
  /** 화면 낭독기 이름. 생략하면 'Edulleo' (브랜드명, 번역하지 않음) */
  label?: string;
  className?: string;
};

const TILE: Record<LogoTile, { bg: string; fg: string; border?: string }> = {
  blue: { bg: 'var(--blue)', fg: 'var(--on-blue)' },
  white: { bg: 'var(--surface)', fg: 'var(--blue)', border: 'var(--line)' },
  deep: { bg: 'var(--blue-deep)', fg: 'var(--on-blue)' },
};

/**
 * e 우회로 도형 (DESIGN.md 4장 기준 SVG, viewBox 0 0 48 48).
 * 출발역(빈 동그라미, 속은 바탕색) → 가로획 → 한 바퀴 고리 → 도착점(꽉 찬 점).
 */
export function LogoMark({ fg, hole, size }: { fg: string; hole: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M14.5 24 H39 A15 15 0 1 0 34.6 34.6"
        fill="none"
        stroke={fg}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={8} cy={24} r={4.6} fill={hole} stroke={fg} strokeWidth={3} />
      <circle cx={34.6} cy={34.6} r={4.4} fill={fg} />
    </svg>
  );
}

/** 앱 로고: 타일(모서리 반지름 = 한 변의 27%) + 선택적 글자 로고 */
export function Logo({
  size = 36,
  tile = 'blue',
  wordmark = false,
  label = 'Edulleo',
  className,
}: LogoProps) {
  const c = TILE[tile];
  return (
    <span className={cx('ui-logo', className)} role="img" aria-label={label} data-tile={tile}>
      <span
        className="ui-logo__tile"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.27),
          background: c.bg,
          boxShadow: c.border ? `inset 0 0 0 1px ${c.border}` : undefined,
        }}
      >
        <LogoMark fg={c.fg} hole={c.bg} size={Math.round(size * 0.78)} />
      </span>
      {wordmark && (
        <span className="ui-logo__wm" aria-hidden="true">
          <b className="ui-logo__name" style={{ fontSize: Math.round(size * 0.58) }}>
            edulleo
          </b>
          <span className="ui-logo__ko" lang="ko" style={{ fontSize: Math.max(11.5, size * 0.32) }}>
            에둘러
          </span>
        </span>
      )}
    </span>
  );
}
