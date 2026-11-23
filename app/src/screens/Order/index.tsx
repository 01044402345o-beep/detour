/**
 * S05 내 주문 · 주문 카드 (T2.3, PRD F-05·F-06).
 * 문장은 domain/orderSentence(buildOrderSentence·toOrderLines), 포장 여부는 store effectiveTakeout.
 * `takeout:false` 장소는 포장/매장 전환을 숨기고 매장으로 고정합니다. 빈 주문이면 연습·직원 버튼 비활성.
 */
import { useNavigate } from 'react-router-dom';
import { pickL10n, useLang, useT } from '../../i18n';
import { phraseInput } from '../../router/navState';
import { PATHS, placePath } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import {
  Button,
  Card,
  Icon,
  ListenButton,
  Pill,
  Pronunciation,
  TopBar,
  cx,
  useToast,
} from '../../ui';
import { MenuArt } from '../Place/PlaceArt';
import { warnIfDropped } from '../Place/log';
import { formatKrw, lineTotal } from './orderMath';
import { QtyStepper } from './QtyStepper';
import { isAtMax, useOrderView } from './useOrder';
import './order.css';

export default function OrderScreen() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const { place, lines, total, takeout, sentence } = useOrderView();
  const increment = useAppStore((s) => s.increment);
  const decrement = useAppStore((s) => s.decrement);
  const setTakeout = useAppStore((s) => s.setTakeout);
  const logEvent = useAppStore((s) => s.logEvent);
  /** lines는 place가 있을 때만 채워집니다 */
  const placeId = place?.id ?? '';

  const onPlay = () => {
    if (!place) return;
    warnIfDropped(
      logEvent({ type: 'phrase_play', src: 'order', placeId: place.id }),
      'phrase_play',
    );
  };

  return (
    <section className="screen order" data-testid="screen-order">
      <TopBar title={t('order.title')} backTo={place ? placePath(place.id) : PATHS.course} />

      {place && (
        <p className="order-place">
          {pickL10n(lang, place.name)} · <span lang="ko">{place.nameKo}</span>
        </p>
      )}

      {sentence ? (
        <div className="okcard" data-testid="order-card">
          <div className="okcard__k">{t('order.sayThis')}</div>
          <p className="okcard__ko" lang="ko" data-testid="order-ko">
            {sentence.ko}
          </p>
          <Pronunciation roman={sentence.roman} kana={sentence.kana} className="okcard__pr" />
          <p className="okcard__mn">{pickL10n(lang, sentence.meaning)}</p>
          <div className="okcard__ctrl">
            <ListenButton
              text={sentence.ko}
              variant="pill"
              className="okcard__listen"
              onPlay={onPlay}
            />
            <ListenButton
              text={sentence.ko}
              rate={0.75}
              variant="pill"
              showNotice={false}
              className="okcard__listen"
              onPlay={onPlay}
            />
          </div>
        </div>
      ) : (
        <Card className="order-empty" data-testid="order-empty">
          <b>{t('order.empty')}</b>
          <span>{t('order.emptyHint')}</span>
        </Card>
      )}

      <div className="order-body">
        {place &&
          (place.takeout ? (
            <div className="toggle" role="radiogroup" aria-label={t('order.title')}>
              <button
                type="button"
                role="radio"
                aria-checked={takeout}
                className={cx(takeout && 'is-on')}
                onClick={() => setTakeout(place, true)}
              >
                <Icon name="bag" size={16} />
                {t('order.togo')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!takeout}
                className={cx(!takeout && 'is-on')}
                onClick={() => setTakeout(place, false)}
              >
                {t('order.here')}
              </button>
            </div>
          ) : (
            <Pill tone="line" data-testid="dine-in-only">
              {t('order.dineInOnly')}
            </Pill>
          ))}

        {lines.length > 0 && (
          <ul className="olist">
            {lines.map((line) => {
              const { item, qty } = line;
              const name = pickL10n(lang, item.name);
              const sum = lineTotal(line);
              return (
                <li key={item.id} className="oi" data-testid={`line-${item.id}`}>
                  <MenuArt menuId={item.id} size={46} />
                  <div className="oi__body">
                    <div className="oi__nm">{name}</div>
                    <div className="oi__sub">
                      <span lang="ko">{item.ko}</span> ·{' '}
                      {sum === null ? (
                        <b className="price-tbd">{t('menu.priceTbd')}</b>
                      ) : (
                        formatKrw(sum)
                      )}
                    </div>
                  </div>
                  <QtyStepper
                    qty={qty}
                    name={name}
                    onIncrement={() => {
                      if (isAtMax(qty)) toast(t('menu.maxQty'));
                      else increment(placeId, item.id);
                    }}
                    onDecrement={() => decrement(placeId, item.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="order-total">
            <span>{t('menu.samplePrices')}</span>
            <b className={cx(total === null && 'is-tbd')} data-testid="order-total">
              {total === null ? t('menu.totalTbd') : t('menu.est', { price: formatKrw(total) })}
            </b>
          </div>
        )}
      </div>

      <div className="order-actions">
        <Button
          variant="acc"
          icon="mic"
          disabled={!sentence}
          onClick={() => navigate(PATHS.practice, { state: phraseInput('order') })}
        >
          {t('order.practice')}
        </Button>
        <Button
          variant="ghost"
          icon="text"
          disabled={!sentence}
          onClick={() => navigate(PATHS.staff, { state: phraseInput('order') })}
        >
          {t('order.showStaff')}
        </Button>
      </div>
    </section>
  );
}
