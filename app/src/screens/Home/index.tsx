/**
 * S01 홈 (T2.1 → T6.2, PRD F-02 v0.11, DESIGN.md 7장 '홈').
 * 대전 도시철도 1호선 세로 노선 위 3권역 사진 카드 (실제 노선 순서: 대전역 → 중앙로 → 유성온천).
 * - 대전역·소제동: 전통시장 코스 줄(→ 시장 코스, T5.1). 야시장 한 줄은 행사 기간 안일 때만(season.ts 판단 재사용).
 * - 원도심(대표): 코스 요약·출발 안내 + "Start the course"(→ 원도심 코스). 기존 '오늘의 코스'를 대신합니다.
 * - 유성온천: Coming later, 누르면 "준비 중" 알림.
 * 오늘의 문장·1박 배너·인사말·가로 캐러셀은 v0.11에서 뺐습니다(문장 듣기는 장소·문장 모음 화면에 그대로).
 * screen_view는 라우터가 기록합니다.
 */
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { bundles, getBundle, type CourseBundle } from '../../data';
import { photoCreditParams, photoForArea, photoUrl, type AreaId, type Photo } from '../../data/photos';
import { pickL10n, useLang, useT } from '../../i18n';
import { LANG_NAMES } from '../../i18n/langNames';
import { coursePath, PATHS } from '../../router/routes';
import type { Lang, SeasonEvent } from '../../types';
import { Button, Icon, Logo, useToast } from '../../ui';
import { seasonStatus } from '../Course/season';
import { closedDaysLabel } from '../Place/hours';
import './home.css';

/** 대전역·소제동 거점 안의 전통시장 코스 (T5.1) */
const MARKET_COURSE_ID = 'jungang-market';
const DOWNTOWN = bundles[0];
const MARKET = getBundle(MARKET_COURSE_ID);

/** 시즌 행사 기간 안(열림·오늘·다음 개장일)인지. 시작 전·끝남이면 홈에서 숨깁니다 */
const IN_SEASON = new Set(['open', 'today', 'next']);

/** 숫자(정수·소수)를 고정폭 숫자로 감쌉니다 (DESIGN.md 1·3장) */
function withNums(text: string): ReactNode[] {
  return text
    .split(/(\d+(?:\.\d+)?)/)
    .map((part, i) => (i % 2 === 1 ? <span key={i} className="num home-n">{part}</span> : part));
}

/** 코스 요약 "4 stops · 2.2 km · about 3 hrs" (코스 화면과 같은 계산) */
function useCourseMeta() {
  const t = useT();
  return (b: CourseBundle) =>
    t('course.meta', {
      stops: b.course.stops.length,
      km: b.course.distanceKm,
      hours: Math.round((b.course.durationMin / 60) * 10) / 10,
    });
}

function fmtDate(lang: Lang, date: string): string {
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** 시각 갱신 간격 (ms) */
export const HOME_TICK_MS = 60_000;

/** 지금 시각. 1분마다, 그리고 화면이 다시 보일 때(visibilitychange) 갱신. 언마운트 시 정리 */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, HOME_TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}

/** 권역 사진 (사진 위 글자는 .home-ph__tx 막 위에) */
function AreaPhoto({ photo, eager }: { photo: Photo | undefined; eager: boolean }) {
  const lang = useLang();
  if (!photo) return null;
  return (
    <img
      className="home-ph__img"
      src={photoUrl(photo)}
      alt={pickL10n(lang, photo.alt)}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

/** 사진 위 상태 알약 (흰 바탕) */
function Status({ later = false }: { later?: boolean }) {
  const t = useT();
  return (
    <span className={later ? 'home-st home-st--later' : 'home-st'}>
      {later ? t('home.later') : t('home.areaOpen')}
    </span>
  );
}

/** 야시장 한 줄 — 기간 안일 때만 */
function NightMarketLine({ event, now }: { event: SeasonEvent; now: Date }) {
  const t = useT();
  const lang = useLang();
  if (!IN_SEASON.has(seasonStatus(event, now).kind)) return null;
  return (
    <p className="home-quiet" data-testid="home-night-market">
      {withNums(
        t('home.nightMarket', {
          days: closedDaysLabel(event.days, lang) ?? '',
          hours: event.hours.replace('-', '–'),
          end: fmtDate(lang, event.endDate),
        }),
      )}
    </p>
  );
}

export default function HomeScreen() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const courseMeta = useCourseMeta();
  // 야시장 기간 판단 시각: 1분마다·화면이 다시 보일 때 갱신 (홈에 머문 채 시즌 경계를 넘어도 맞게, R1 L-3)
  const now = useNow();

  const soon = () => toast(t('home.soonToast'));
  const toCourse = () => navigate(coursePath());
  /** 원도심 카드 아무 곳이나 눌러도 코스로 (시작 버튼은 자기 클릭으로 처리) */
  const onDowntownClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as Element).closest('button')) return;
    toCourse();
  };

  const photos: Record<AreaId, Photo | undefined> = {
    station: photoForArea('station'),
    downtown: photoForArea('downtown'),
    yuseong: photoForArea('yuseong'),
  };
  const shown = Object.values(photos).filter((p): p is Photo => p !== undefined);
  const credit =
    shown.length > 0
      ? t('photo.credit', {
          author: [...new Set(shown.map((p) => photoCreditParams(p).author))].join(', '),
          license: [...new Set(shown.map((p) => photoCreditParams(p).license))].join(', '),
        })
      : null;

  const start = DOWNTOWN.course.start;
  const langName = LANG_NAMES[lang];

  return (
    <section
      className="screen home"
      lang={lang === 'zh' ? 'zh-Hans' : lang}
      data-testid="screen-home"
    >
      <header className="home-top">
        <Logo size={36} wordmark />
        <button
          type="button"
          className="home-lang"
          onClick={() => navigate(PATHS.settings)}
          aria-label={t('home.langButton', { lang: langName.name })}
          data-testid="home-lang"
        >
          <Icon name="globe" size={20} />
          {langName.badge}
        </button>
      </header>

      <h1 className="home-h1">
        <span className="home-h1__no num" aria-hidden="true">
          {1}
        </span>
        {t('home.lineTitle')}
      </h1>

      <ol className="home-line" aria-label={t('home.lineLabel')}>
        {MARKET ? (
          <li className="home-stn">
            <span className="home-dot" aria-hidden="true" />
            <div className="home-stn__body">
              <button
                type="button"
                className="home-area"
                onClick={() => navigate(coursePath(MARKET.course.id))}
                data-testid="hub-station"
              >
                <span className="home-ph home-ph--sm">
                  <AreaPhoto photo={photos.station} eager />
                  <Status />
                  <span className="home-ph__tx">
                    <span className="home-ph__stn">{t('home.stnStation')}</span>
                    <span className="home-ph__area">{t('home.hubStation')}</span>
                    <span className="home-ph__desc">{t('home.hubStationSub')}</span>
                  </span>
                </span>
                <span className="home-row">
                  <span className="home-row__tx">
                    <span className="home-row__t">{pickL10n(lang, MARKET.course.title)}</span>
                    <span className="home-row__m">{withNums(courseMeta(MARKET))}</span>
                  </span>
                  <Icon name="forward" size={20} />
                </span>
              </button>
              {(MARKET.course.events ?? []).map((ev) => (
                <NightMarketLine key={ev.id} event={ev} now={now} />
              ))}
            </div>
          </li>
        ) : null}

        <li className="home-stn home-stn--feat">
          <span className="home-dot home-dot--feat" aria-hidden="true" />
          <article
            className="home-panel"
            aria-labelledby="home-downtown-title"
            onClick={onDowntownClick}
            data-testid="hub-downtown"
          >
            <div className="home-ph home-ph--lg">
              <AreaPhoto photo={photos.downtown} eager />
              <Status />
              <div className="home-ph__tx">
                <span className="home-ph__stn">{t('home.stnDowntown')}</span>
                <h2 className="home-ph__area home-ph__area--lg" id="home-downtown-title">
                  {t('home.hubDown')}
                </h2>
                <span className="home-ph__desc">{t('home.hubDownSub')}</span>
              </div>
            </div>
            <div className="home-course">
              <p className="home-course__t">{pickL10n(lang, DOWNTOWN.course.title)}</p>
              <p className="home-course__m">{withNums(courseMeta(DOWNTOWN))}</p>
              <p className="home-course__from">
                <Icon name="pin" size={16} />
                <span>{t('home.startsAt', { place: pickL10n(lang, start.name) })}</span>
              </p>
              <Button
                variant="ink"
                className="home-cta"
                onClick={toCourse}
                data-testid="home-start"
              >
                {t('home.startCourse')}
                <Icon name="forward" size={20} />
              </Button>
            </div>
          </article>
        </li>

        <li className="home-stn">
          <span className="home-dot" aria-hidden="true" />
          <div className="home-stn__body">
            <button type="button" className="home-area" onClick={soon} data-testid="hub-yuseong">
              <span className="home-ph home-ph--sm">
                <AreaPhoto photo={photos.yuseong} eager={false} />
                <Status later />
                <span className="home-ph__tx">
                  <span className="home-ph__stn">{t('home.stnYuseong')}</span>
                  <span className="home-ph__area">{t('home.hubYuseong')}</span>
                  <span className="home-ph__desc">{withNums(t('home.yuseongDesc'))}</span>
                </span>
              </span>
            </button>
          </div>
        </li>
      </ol>

      {credit && (
        <p className="home-credit" data-testid="home-photo-credit">
          <Icon name="info" size={14} />
          <span>{credit}</span>
        </p>
      )}
    </section>
  );
}
