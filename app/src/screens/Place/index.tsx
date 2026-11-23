/**
 * S03·S04 장소 상세 (T2.3, PRD F-04·F-05·F-13·F-14).
 * - 탭: 메뉴 / 이용 방법 / 문장. `orderable:false`면 메뉴 탭 없이 이용 방법 탭으로 엽니다.
 * - 같은 라우트에서 :id만 바뀌면 콘텐츠 루트에 key={id}를 줘 듣기 버튼 등을 다시 마운트합니다.
 * - screen_view는 라우터가 기록하고, 이 화면은 place_view·phrase_play만 기록합니다.
 */
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getPlace, places, type ContentPlace } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { PATHS } from '../../router/routes';
import { phraseInput } from '../../router/navState';
import { useAppStore } from '../../store/useAppStore';
import { Button, IconButton, Pill, cx, useToast } from '../../ui';
import { ReportSheet } from '../../ui/ReportSheet';
import { formatKrw } from '../Order/orderMath';
import { useOrderView } from '../Order/useOrder';
import { openStatus } from './hours';
import { HowTab, PhrasesTab } from './InfoTabs';
import { MenuTab } from './MenuTab';
import { PlaceArt } from './PlaceArt';
import { SwitchPlaceSheet } from './SwitchPlaceSheet';
import { warnIfDropped } from './log';
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

/** 앱 안 이전 화면이 있으면 뒤로, 없으면(바로 열기) 코스로 */
function useBack() {
  const navigate = useNavigate();
  return () => {
    const state = window.history.state as { idx?: unknown } | null;
    if (typeof state?.idx === 'number' && state.idx > 0) navigate(-1);
    else navigate(PATHS.course, { replace: true });
  };
}

function PlaceView({ place }: { place: ContentPlace }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const back = useBack();
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
  const here = order.place?.id === place.id ? order : null;
  const onToggleSave = () => {
    const on = toggleSavedPlace(place.id);
    toast(t(on ? 'saved.savedToast' : 'saved.removedToast'));
  };

  return (
    <section className="screen place" data-testid="screen-place">
      <div className="place-hero">
        <PlaceArt placeId={place.id} category={place.category} />
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
      </div>

      <div className="place-sheet">
        <div className="place-badges">
          <Pill tone="acc">{t('course.stopOf', { n: place.order, total: places.length })}</Pill>
          {place.verified ? (
            <Pill tone="sea" icon="check" data-testid="verified-badge">
              {t('course.checked', { date: place.checkedAt })}
            </Pill>
          ) : (
            <Pill tone="line" icon="info" data-testid="verified-badge">
              {t('place.unverified')}
            </Pill>
          )}
        </div>
        <h1 className="place-name">{pickL10n(lang, place.name)}</h1>
        <p className="place-sub">
          <span lang="ko">{place.nameKo}</span> · {pickL10n(lang, place.areaLocal)}
          {status && (
            <>
              {' · '}
              <b
                className={status === 'open' ? 'is-open' : 'is-closed'}
                data-testid="open-status"
                aria-describedby="place-status-note"
              >
                {t(status === 'open' ? 'place.openNow' : 'place.closedNow')}
              </b>
            </>
          )}
        </p>
        {status && (
          // 영업 상태는 등록된 시간표(Asia/Seoul) 기준 참고값 — 모든 탭에서 상태 옆에 안내 (PRD F-04, R1 M-02)
          <p id="place-status-note" className="place-status-note" data-testid="status-note">
            {t('place.statusNote')}
          </p>
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

      <div className="orderbar">
        {here && here.count > 0 ? (
          <Button
            variant="ink"
            className="orderbar__btn"
            onClick={() => navigate(PATHS.order)}
            data-testid="orderbar"
          >
            <span className="orderbar__left">
              <span className="orderbar__cnt" aria-label={t('menu.items', { count: here.count })}>
                {here.count}
              </span>
              {t('menu.viewOrder')}
            </span>
            <span className="orderbar__sum">
              {here.total === null
                ? t('menu.totalTbd')
                : t('menu.est', { price: formatKrw(here.total) })}
            </span>
          </Button>
        ) : (
          <Button
            variant="acc"
            icon="mic"
            onClick={() =>
              navigate(PATHS.practice, { state: phraseInput('phrase', place.phrases[0].id) })
            }
          >
            {t('phrases.practice')} · {place.phrases.length}
          </Button>
        )}
      </div>

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
