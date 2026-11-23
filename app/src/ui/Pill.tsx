import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type PillTone = 'acc' | 'sea' | 'plum' | 'ink' | 'line';

export type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: PillTone;
  icon?: IconName;
  children: ReactNode;
};

/** 작은 상태 표시 알약 (목업 .pill). 누르는 용도가 아닙니다 — 누를 것은 Button/IconButton. */
export function Pill({ tone = 'line', icon, className, children, ...rest }: PillProps) {
  return (
    <span className={cx('ui-pill', `ui-pill--${tone}`, className)} {...rest}>
      {icon && <Icon name={icon} size={12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}
