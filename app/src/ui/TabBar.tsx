import { NavLink } from 'react-router-dom';
import { useT, type MessageKey } from '../i18n';
import { PATHS } from '../router/routes';
import type { IconName } from './Icon';
import { Icon } from './Icon';

type Tab = { to: string; label: MessageKey; icon: IconName };

/** 하단 탭 5개 (목업 .tabbar). Me 탭 = 설정 */
const TABS: readonly Tab[] = [
  { to: PATHS.home, label: 'nav.explore', icon: 'compass' },
  { to: PATHS.course, label: 'nav.course', icon: 'map' },
  { to: PATHS.phrases, label: 'nav.phrases', icon: 'chat' },
  { to: PATHS.saved, label: 'nav.saved', icon: 'bookmark' },
  { to: PATHS.settings, label: 'nav.me', icon: 'user' },
];

/** 하단 탭바. 앱 틀(AppLayout)이 라우트 표의 tabBar 값에 따라 붙입니다 — 화면에서 직접 넣지 마세요. */
export function TabBar() {
  const t = useT();
  return (
    <nav className="ui-tabbar">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className="ui-tab">
          <Icon name={tab.icon} size={22} />
          {t(tab.label)}
        </NavLink>
      ))}
    </nav>
  );
}
