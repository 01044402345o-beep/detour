import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName;
  /** 화면 낭독기 이름 (필수, t()로 번역한 문구) */
  label: string;
  iconSize?: number;
};

/** 동그란 아이콘 버튼 (목업 .icb 40px → 터치 영역 44px) */
export function IconButton({
  icon,
  label,
  iconSize = 20,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button type={type} className={cx('ui-icb', className)} aria-label={label} {...rest}>
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
