/**
 * S03·S04 장소 상세 (T2.3, PRD F-04·F-05·F-13·F-14).
 * - 탭: 메뉴 / 이용 방법 / 문장. `orderable:false`면 메뉴 탭 없이 이용 방법 탭으로 엽니다.
 * - 같은 라우트에서 :id만 바뀌면 콘텐츠 루트에 key={id}를 줘 듣기 버튼 등을 다시 마운트합니다.
 * - 음성 가이드(T6.14): 진행 막대 아래 '가이드 듣기' → 팝업에서 대표 메뉴·주문 방법을 화면 언어로 읽고 글도 보여 줌.
 * - screen_view는 라우터가 기록하고, 이 화면은 place_view·phrase_play만 기록합니다.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { bundleOfPlace, getPlace, type ContentPlace } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { PATHS, coursePath } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import {
  isDishExample,
  photoCreditKey,
  photoCreditParams,
  photoForPlace,
  photoUrl,
} from '../../data/photos';
import { Button, GuidePlayer, Icon, IconButton, cx, useToast } from '../../ui';
import { PLACE_GUIDES } from '../../data/guides';
import { ReportSheet } from '../../ui/ReportSheet';
import { formatKrw } from '../Order/orderMath';
import { useOrderView } from '../Order/useOrder';
import { dayLabel, nextOpening, openStatus } from './hours';
import { HowTab, PhrasesTab } from './InfoTabs';
import { MenuTab } from './MenuTab';
import { SwitchPlaceSheet } from './SwitchPlaceSheet';
import { warnIfDropped } from './log';
import { NumIn } from './numText';
import './place.css';

export type PlaceTab = 'menu' | 'how' | 'phrases';

function tabsFor(place: Pick<ContentPlace, 'orderable' | 'menu'>): PlaceTab[] {
  return place.orderable && place.menu?.length ? ['menu', 'how', 'phrases'] : ['how', 'phrases'];
}

/** location.state.tab이 이 장소의 탭이면 그 탭, 아니면 첫 탭 */
function initialTab(tabs: PlaceTab[], state: unknown): PlaceTab {
  const want = (state as { tab?: unknown } | null)?.tab;
  return tabs.find((k) => k === want) ?? tabs[0];
}

export default function PlaceScreen() {
  const { id = '' } = useParams();
  const location = useLocation();
  const place = getPlace(id);
  if (!place) return <Navigate to={PATHS.course} replace />;
  // 새 history entry(같은 장소 재이동 포함)마다 다시 마운트 → state.tab·시트·보류 메뉴 초기화 (R1 L-01).
  // 탭 누르기는 navigation이 아니므로 초기화되지 않습니다.
  return <PlaceView key={`${place.id}:${location.key}`} place={place} />;
}

/** 앱 안 이전 화면이 있으면 뒤로, 없으면(바로 열기) 이 장소가 속한 코스로 */
function useBack(placeId: string) {
  const navigate = useNavigate();
  return () => {
    const state = window.history.state as { idx?: unknown } | null;
    if (typeof state?.idx === 'number' && state.idx > 0) navigate(-1);
    else navigate(coursePath(bundleOfPlace(placeId)?.course.id), { replace: true });
  };
}

function PlaceView({ place }: { place: ContentPlace }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const back = useBack(place.id);
  const logEvent = useAppStore((s) => s.logEvent);
  const saved = useAppStore((s) => s.saved.places.includes(place.id));
  const toggleSavedPlace = useAppStore((s) => s.toggleSavedPlace);
  const order = useOrderView();

  const tabs = tabsFor(place);
  // 직원 응답(S09) '주문 수정' 등이 { tab: 'menu' }로 특정 탭을 열 수 있음 (없거나 이 장소에 없는 탭이면 기본 탭)
  const [tab, setTab] = useState<PlaceTab>(() => initialTab(tabs, location.state));
  /** 열린 시트 (시트 겹침 미지원 — 한 번에 하나만) */
  const [sheet, setSheet] = useState<'report' | 'switch' | null>(null);
  /** 장소 전환 확인 뒤 담을 메뉴 */
  const [pendingMenuId, setPendingMenuId] = useState<string | null>(null);

  // place_view: 화면 진입(location.key)당 1회 — StrictMode 이중 실행에도 한 번만
  const loggedKey = useRef<string | null>(null);
  useEffect(() => {
    if (loggedKey.current === location.key) return;
    loggedKey.current = location.key;
    warnIfDropped(logEvent({ type: 'place_view', placeId: place.id }), 'place_view');
  }, [location.key, logEvent, place.id]);

  const status = openStatus(place);
  const opening = status === 'closed' ? nextOpening(place) : null;
  const here = order.place?.id === place.id ? order : null;
  const photo = photoForPlace(place.id);
  // 음식 예시 사진(T6.9): 그 가게에서 찍은 사진이 아님을 사진 위·출처 줄에 표시
  const dishPhoto = !!photo && isDishExample(photo);
  const bundle = bundleOfPlace(place.id);
  const total = bundle?.places.length ?? place.order;
  const next = bundle?.places.find((p) => p.order === place.order + 1);
  const onToggleSave = () => {
    const on = toggleSavedPlace(place.id);
    toast(t(on ? 'saved.savedToast' : 'saved.removedToast'));
  };
  const openingText =
    opening &&
    (opening.inDays === 0
      ? t('place.opensAt', { time: opening.time })
      : opening.inDays === 1
        ? t('place.opensTomorrow', { time: opening.time })
        : t('place.opensOn', { day: dayLabel(opening.day, lang), time: opening.time }));
  const progress = { '--p': total > 1 ? (place.order - 1) / (total - 1) : 0 } as CSSProperties;

  return (
    <section className="screen place" data-testid="screen-place">
      <header
        className={cx('place-hero', photo ? 'place-hero--photo' : 'place-hero--text')}
        data-testid="place-hero"
        data-photo={photo ? photo.id : 'none'}
        data-photo-kind={photo ? photo.kind : undefined}
      >
        {photo && (
          <img
            className="place-hero__img"
            src={photoUrl(photo)}
            alt={pickL10n(lang, photo.alt)}
            loading="eager"
            decoding="async"
          />
        )}
        <div className="place-hero__bar">
          <IconButton icon="back" label={t('common.back')} onClick={back} />
          <span className="place-hero__right">
            <IconButton icon="flag" label={t('report.open')} onClick={() => setSheet('report')} />
            <IconButton
              icon="bookmark"
              label={t(saved ? 'place.unsave' : 'place.save')}
              aria-pressed={saved}
              className={cx(saved && 'is-on')}
              onClick={onToggleSave}
            />
          </span>
        </div>
        <div className="place-hero__tx">
          {dishPhoto && (
            <p className="place-hero__dish" data-testid="dish-example-label">
              {t('photo.dishExample')}
            </p>
          )}
          <h1 className="place-hero__h">
            <span className="place-hero__ko" lang="ko">
              {place.nameKo}
            </span>
            <span className="place-hero__name">{pickL10n(lang, place.name)}</span>
          </h1>
          <p className="place-hero__meta">
            {t(place.category === 'food' ? 'place.kindFood' : 'place.kindSight')}
            {' · '}
            {pickL10n(lang, place.areaLocal)}
          </p>
          {status && (
            <p className="place-hero__st">
              <span
                className={cx('place-status', status === 'open' ? 'is-open' : 'is-closed')}
                data-testid="open-status"
                aria-describedby="place-status-note"
              >
                {t(status === 'open' ? 'place.openNow' : 'place.closedNow')}
              </span>
              {opening && openingText ? (
                <span className="place-hero__next" data-testid="next-open">
                  <NumIn text={openingText} value={opening.time} />
                </span>
              ) : (
                <span className="place-hero__hours num">{place.hours}</span>
              )}
            </p>
          )}
          {photo && (
            <p className="place-hero__credit" data-testid="photo-credit">
              {t(photoCreditKey(photo), photoCreditParams(photo))}
            </p>
          )}
        </div>
      </header>

      <div className="place-prog" data-testid="place-progress">
        <p className="place-prog__t">
          <b>{t('place.stopOf', { n: place.order, total })}</b>
          {' · '}
          {next
            ? t('place.nextStop', { name: pickL10n(lang, next.name), min: next.walkMinFromPrev })
            : t('place.lastStop')}
        </p>
        <span className="place-prog__line" aria-hidden="true" style={progress}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cx(
                'place-prog__dot',
                i + 1 < place.order && 'is-past',
                i + 1 === place.order && 'is-cur',
              )}
            />
          ))}
        </span>
      </div>

      {/* T6.14 장소 음성 가이드: 대표 메뉴·주문 방법·이용 팁 */}
      {PLACE_GUIDES[place.id] && (
        <div className="place-guide">
          <GuidePlayer
            guide={PLACE_GUIDES[place.id]}
            title={pickL10n(lang, place.name)}
            buttonLabel={t('guide.placeButton')}
            testId="place-guide"
          />
        </div>
      )}

      <div className="place-tabs" role="tablist">
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`place-tab-${k}`}
            aria-controls="place-panel"
            aria-selected={tab === k}
            className={cx('place-tab', tab === k && 'is-on')}
            onClick={() => setTab(k)}
          >
            {t(
              k === 'menu'
                ? 'place.tabMenu'
                : k === 'phrases'
                  ? 'place.tabPhrases'
                  : place.category === 'food'
                    ? 'place.tabHow'
                    : 'place.tabVisit',
            )}
          </button>
        ))}
      </div>

      <div className="place-body">
        {/* 확인 전 안내는 장소당 한 줄 (DESIGN.md 6장) */}
        <p className="place-note" data-testid="verified-badge">
          <Icon name={place.verified ? 'check' : 'info'} size={14} />
          <span>
            {place.verified
              ? t('course.checked', { date: place.checkedAt })
              : t('place.unverified')}
          </span>
        </p>
        {status && (
          // 영업 상태는 등록된 시간표(Asia/Seoul) 기준 참고값 — 모든 탭에서 상태 옆에 안내 (PRD F-04, R1 M-02)
          <p
            id="place-status-note"
            className="place-note place-note--sub"
            data-testid="status-note"
          >
            {t('place.statusNote')}
          </p>
        )}

        <div id="place-panel" role="tabpanel" aria-labelledby={`place-tab-${tab}`}>
          {tab === 'menu' && (
            <MenuTab
              place={place}
              onNeedSwitch={(menuId) => {
                setPendingMenuId(menuId);
                setSheet('switch');
              }}
            />
          )}
          {tab === 'how' && <HowTab place={place} />}
          {tab === 'phrases' && <PhrasesTab place={place} />}
        </div>

        <p className="place-disclaimer">
          {t('place.disclaimer')} {t('place.takedown')}
        </p>
      </div>

      {here && here.count > 0 && (
        // 담은 메뉴가 있을 때만 아래 파란 주문 바 (DESIGN.md 7장 '장소'). 연습은 Phrases 탭 안에서
        <div className="orderbar">
          <Button
            variant="ink"
            className="orderbar__btn"
            onClick={() => navigate(PATHS.order)}
            data-testid="orderbar"
          >
            <span className="orderbar__left">
              <span
                className="orderbar__cnt num"
                aria-label={t('menu.items', { count: here.count })}
              >
                {here.count}
              </span>
              <span className={cx('orderbar__sum', here.total !== null && 'is-price')}>
                {here.total === null ? (
                  t('menu.totalTbd')
                ) : (
                  <NumIn
                    text={t('menu.est', { price: formatKrw(here.total) })}
                    value={formatKrw(here.total)}
                  />
                )}
              </span>
            </span>
            <span className="orderbar__go">
              {t('menu.viewOrder')}
              <Icon name="forward" size={20} />
            </span>
          </Button>
        </div>
      )}

      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} placeId={place.id} />
      <SwitchPlaceSheet
        open={sheet === 'switch'}
        place={place}
        menuId={pendingMenuId}
        onClose={() => {
          setSheet(null);
          setPendingMenuId(null);
        }}
      />
    </section>
  );
}
