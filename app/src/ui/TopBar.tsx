import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { cx } from './cx';
import { IconButton } from './IconButton';

export type TopBarProps = {
  title?: ReactNode;
  /** 뒤로 버튼 동작. 생략하면 앱 안 이전 화면, 이전 화면이 없으면 backTo로 이동 */
  onBack?: () => void;
  /** 앱 안 이전 화면이 없을 때(바로 열기·새로고침) 갈 경로. 기본 '/' */
  backTo?: string;
  /** false면 뒤로 버튼 숨김 */
  showBack?: boolean;
  /** 오른쪽 자리 (IconButton 등) */
  right?: ReactNode;
  className?: string;
};

/** 앱 안에서 쌓인 이전 화면이 있는지 (React Router가 history.state.idx를 둡니다) */
function hasInAppHistory(): boolean {
  const state = window.history.state as { idx?: unknown } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

/** 상단 바 (목업 .topbar): 뒤로 · 가운데 제목 · 오른쪽 자리 */
export function TopBar({
  title,
  onBack,
  backTo = '/',
  showBack = true,
  right,
  className,
}: TopBarProps) {
  const t = useT();
  const navigate = useNavigate();
  const back = () => {
    if (onBack) onBack();
    else if (hasInAppHistory()) navigate(-1);
    else navigate(backTo, { replace: true });
  };
  return (
    <header className={cx('ui-topbar', className)}>
      <div className="ui-topbar__side">
        {showBack && <IconButton icon="back" label={t('common.back')} onClick={back} />}
      </div>
      <h1 className="ui-topbar__title">{title}</h1>
      <div className="ui-topbar__side">{right}</div>
    </header>
  );
}
