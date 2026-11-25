/**
 * S03 메뉴 탭 (F-04·F-05, T6.4): 메뉴 줄(한국어 이름 → 사용자 언어 이름 → 고정폭 가격), +/− 수량,
 * 담은 줄은 연파랑 바탕. 가격 미정·알레르기 미정은 중립 회색(빨강·주황 금지, DESIGN.md 2장).
 */
import type { ContentMenuItem, ContentPlace } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { Icon, cx, useToast } from '../../ui';
import { formatKrw } from '../Order/orderMath';
import { AddButton, QtyStepper } from '../Order/QtyStepper';
import { isAtMax } from '../Order/useOrder';

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

  const allergyUnknown = !place.allergens || menu.some((m) => m.allergenStatus === 'unknown');

  return (
    <div className="menu-tab">
      <ul className="menu-list">
        {menu.map((item) => {
          const qty = qtys?.[item.id] ?? 0;
          const name = pickL10n(lang, item.name);
          return (
            <li
              key={item.id}
              className={cx('mrow', qty > 0 && 'is-sel')}
              data-testid={`menu-${item.id}`}
            >
              <div className="mrow__body">
                <p className="mrow__ko" lang="ko">
                  {item.ko}
                </p>
                <p className="mrow__nm">
                  {name}
                  {item.signature && (
                    <>
                      {' '}
                      <span className="mrow__tag">{t('menu.signature')}</span>
                    </>
                  )}
                  {item.spicy && (
                    <>
                      {' '}
                      <span className="mrow__tag">{t('menu.spicy')}</span>
                    </>
                  )}
                </p>
                <p className="mrow__pr">
                  {item.priceKrw === undefined ? (
                    <span className="mrow__ask" data-testid="price-ask">
                      {t('menu.priceAsk')}
                    </span>
                  ) : (
                    <>
                      <span className="num">{formatKrw(item.priceKrw)}</span>
                      {item.counter === '인분' && (
                        <>
                          {' '}
                          <small className="mrow__small">{t('menu.perPerson')}</small>
                        </>
                      )}
                      {!item.verified && (
                        <>
                          {' '}
                          <small className="mrow__small">{t('menu.sample')}</small>
                        </>
                      )}
                    </>
                  )}
                </p>
                {item.description && <p className="mrow__ds">{pickL10n(lang, item.description)}</p>}
                {item.allergenStatus === 'confirmed' && item.allergens && (
                  <p className="mrow__ds">
                    {t('place.contains')}: {pickL10n(lang, item.allergens)}
                  </p>
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
            </li>
          );
        })}
      </ul>
      <div className="allergy" role="note" data-testid="allergy">
        <Icon name="info" size={14} />
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
