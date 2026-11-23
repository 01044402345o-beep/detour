import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'ink' | 'acc' | 'sea' | 'ghost';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant;
  /** 앞쪽 아이콘 */
  icon?: IconName;
  /** true면 글자 폭만큼 (기본: 가로 꽉 채움) */
  inline?: boolean;
  children: ReactNode;
};

/** 큰 버튼 (목업 .btn: 높이 52px, 반경 16px). 문구는 t()로 넘기세요. */
export function Button({
  variant = 'ink',
  icon,
  inline = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('ui-btn', `ui-btn--${variant}`, inline && 'ui-btn--inline', className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}
