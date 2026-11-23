import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type CardProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

/** 흰 카드 (목업 .card: 반경 20px, 선 --line) */
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={cx('ui-card', className)} {...rest}>
      {children}
    </div>
  );
}

export type CardButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode };

/** 누를 수 있는 카드 (button 요소, 최소 높이 44px) */
export function CardButton({ className, type = 'button', children, ...rest }: CardButtonProps) {
  return (
    <button type={type} className={cx('ui-card', 'ui-card--action', className)} {...rest}>
      {children}
    </button>
  );
}
