/** 다른 장소의 주문이 남아 있을 때 비울지 묻는 시트 (F-05). store.pendingPlace와 짝 */
import type { ContentPlace } from '../../data';
import { getPlace } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { Button, Sheet } from '../../ui';

type Props = {
  open: boolean;
  /** 새로 주문하려는 장소 */
  place: ContentPlace;
  /** 확인하면 바로 1개 담을 메뉴 */
  menuId: string | null;
  onClose: () => void;
};

export function SwitchPlaceSheet({ open, place, menuId, onClose }: Props) {
  const t = useT();
  const lang = useLang();
  const currentPlaceId = useAppStore((s) => s.currentPlaceId);
  const confirmSwitchPlace = useAppStore((s) => s.confirmSwitchPlace);
  const cancelSwitchPlace = useAppStore((s) => s.cancelSwitchPlace);
  const increment = useAppStore((s) => s.increment);
  const prev = currentPlaceId ? getPlace(currentPlaceId) : undefined;

  const keep = () => {
    cancelSwitchPlace();
    onClose();
  };
  const confirm = () => {
    confirmSwitchPlace();
    if (menuId) increment(place.id, menuId);
    onClose();
  };

  return (
    <Sheet open={open} onClose={keep} title={t('menu.switchTitle')}>
      <p className="switch-sheet__body">
        {t('menu.switchBody', { place: prev ? pickL10n(lang, prev.name) : '' })}
      </p>
      <div className="switch-sheet__actions">
        <Button variant="ink" onClick={confirm}>
          {t('menu.switchConfirm')}
        </Button>
        <Button variant="ghost" onClick={keep}>
          {t('menu.switchKeep')}
        </Button>
      </div>
    </Sheet>
  );
}
