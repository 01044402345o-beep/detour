/** S03 메뉴 탭 (F-04·F-05): 메뉴 카드, +/− 수량, 가격 미확인 표시, 알레르기 */
import type { ContentMenuItem, ContentPlace } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { Card, Icon, Pill, useToast } from '../../ui';
import { formatKrw } from '../Order/orderMath';
import { AddButton, QtyStepper } from '../Order/QtyStepper';
import { isAtMax } from '../Order/useOrder';
import { MenuArt } from './PlaceArt';

type Props = {
  place: ContentPlace;
  /** 다른 장소의 주문이 남아 있어 전환 확인이 필요할 때 (담으려던 메뉴) */
  onNeedSwitch: (menuId: string) => void;
};

export function MenuTab({ place, onNeedSwitch }: Props) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const menu = place.menu ?? [];
  const isCurrent = useAppStore((s) => s.currentPlaceId === place.id);
  const qtys = useAppStore((s) => (s.currentPlaceId === place.id ? s.cart[place.id] : undefined));
  const switchPlace = useAppStore((s) => s.switchPlace);
  const increment = useAppStore((s) => s.increment);
  const decrement = useAppStore((s) => s.decrement);

  const add = (item: ContentMenuItem) => {
    if (!isCurrent) {
      const { needsConfirm } = switchPlace({ id: place.id, takeout: place.takeout });
      if (needsConfirm) {
        onNeedSwitch(item.id);
        return;
      }
    }
    if (isAtMax(qtys?.[item.id] ?? 0)) {
      toast(t('menu.maxQty'));
      return;
    }
    increment(place.id, item.id);
  };

  const anySample = menu.some((m) => !m.verified);
  const allergyUnknown = !place.allergens || menu.some((m) => m.allergenStatus === 'unknown');

  return (
    <div className="menu-tab">
      <div className="menu-tab__head">
        <span className="menu-tab__hint">{t('menu.addHint')}</span>
        {anySample && <Pill tone="line">{t('menu.samplePrices')}</Pill>}
      </div>
      {menu.map((item) => {
        const qty = qtys?.[item.id] ?? 0;
        const name = pickL10n(lang, item.name);
        return (
          <Card key={item.id} className="mitem" data-testid={`menu-${item.id}`}>
            <MenuArt menuId={item.id} />
            <div className="mitem__body">
              <div className="mitem__title">
                <span className="mitem__nm">{name}</span>
                {item.signature && (
                  <Pill tone="acc" className="mitem__tag">
                    ★ {t('menu.signature')}
                  </Pill>
                )}
                {item.spicy && (
                  <Pill tone="acc" className="mitem__tag">
                    🌶 {t('menu.spicy')}
                  </Pill>
                )}
              </div>
              <div className="mitem__ko">
                <span lang="ko">{item.ko}</span> ·{' '}
                {item.priceKrw === undefined ? (
                  <b className="price-tbd">{t('menu.priceTbd')}</b>
                ) : (
                  <>
                    {t('menu.est', { price: formatKrw(item.priceKrw) })}
                    {item.counter === '인분' && ` · ${t('menu.perPerson')}`}
                  </>
                )}
              </div>
              {item.description && (
                <div className="mitem__ds">{pickL10n(lang, item.description)}</div>
              )}
              {item.allergenStatus === 'confirmed' && item.allergens && (
                <div className="mitem__ds">
                  {t('place.contains')}: {pickL10n(lang, item.allergens)}
                </div>
              )}
            </div>
            {qty > 0 ? (
              <QtyStepper
                qty={qty}
                name={name}
                onIncrement={() => add(item)}
                onDecrement={() => decrement(place.id, item.id)}
              />
            ) : (
              <AddButton name={name} onClick={() => add(item)} />
            )}
          </Card>
        );
      })}
      <div className="allergy" role="note" data-testid="allergy">
        <Icon name="alert" size={16} />
        <span>
          <b>{t('place.allergyTitle')}</b>
          {place.allergens && (
            <span className="allergy__line">
              {t('place.contains')}: {pickL10n(lang, place.allergens)}
            </span>
          )}
          {allergyUnknown && <span className="allergy__line">{t('place.allergyUnknown')}</span>}
        </span>
      </div>
    </div>
  );
}
