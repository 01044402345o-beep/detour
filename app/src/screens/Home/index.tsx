/**
 * S01 홈 (T2.1, PRD F-02).
 * - 거점 카드: 원도심만 열림(→ 코스 지도). 대전역·소제동, 유성온천과 1박 배너는 "Coming soon" 토스트.
 * - 오늘의 코스: 원도심 반나절 코스 요약(→ 코스 지도).
 * - 오늘의 문장: 한국어 듣기(ListenButton). 재생되면 phrase_play를 실제 데이터 ID로 기록.
 * screen_view는 라우터가 기록합니다.
 */
import { useNavigate } from 'react-router-dom';
import { course, getPlace, places } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { CardButton, Icon, ListenButton, Pill, Pronunciation, useToast } from '../../ui';
import { HubArt } from './HubArt';
import './home.css';

/** 오늘의 문장 (목업과 같은 성심당 "포장해 주세요"). 데이터에서 찾지 못하면 영역을 숨깁니다. */
const TODAY_PLACE_ID = 'ssd';
const TODAY_PHRASE_ID = 'ssd-2';

/** 코스 정류장 사이 도보 시간 합계 (분) */
const WALK_MIN = places.reduce((sum, p) => sum + p.walkMinFromPrev, 0);

export default function HomeScreen() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const logEvent = useAppStore((s) => s.logEvent);

  const soon = () => toast(t('home.soonToast'));
  const toCourse = () => navigate(PATHS.course);

  const todayPhrase = getPlace(TODAY_PLACE_ID)?.phrases.find((p) => p.id === TODAY_PHRASE_ID);
  const stops = course.stops.map((id) => getPlace(id)).filter((p) => p !== undefined);

  const onPlay = () => {
    const ok = logEvent({
      type: 'phrase_play',
      src: 'phrase',
      placeId: TODAY_PLACE_ID,
      phraseId: TODAY_PHRASE_ID,
    });
    if (!ok && import.meta.env.DEV) console.warn('[home] phrase_play dropped');
  };

  return (
    <section className="screen home-screen" data-testid="screen-home">
      <header className="home-brand">
        <div className="home-brand__logo" aria-hidden="true">
          {'D'}
        </div>
        <div>
          <div className="home-brand__name">{'Daejeon Detour'}</div>
          <div className="home-xs">{t('home.location')}</div>
        </div>
        <span className="home-brand__sp" />
        <Pill icon="pin">{t('course.mapStation')}</Pill>
      </header>

      <h1 className="home-hello">
        {t('home.hi')}
        <br />
        {t('home.whereTo')}
      </h1>

      <div className="home-sec">
        <h2 className="home-h-m">{t('home.pickHub')}</h2>
        <button type="button" className="home-link" onClick={toCourse}>
          {t('home.seeMap')}
        </button>
      </div>
      <div className="home-hubs" data-testid="home-hubs">
        <button
          type="button"
          className="home-hub"
          onClick={toCourse}
          data-testid="hub-downtown"
        >
          <HubArt kind="down" />
          <span className="home-hub__info">
            <span className="home-row">
              <span className="home-h-m">{t('home.hubDown')}</span>
              <span className="home-brand__sp" />
              <Pill tone="acc">{t('common.demoBadge')}</Pill>
            </span>
            <span className="home-xs home-hub__sub">{t('home.hubDownSub')}</span>
            <span className="home-row home-hub__meta">
              <span className="home-row">
                <Icon name="pin" size={14} />
                {t('home.spots', { count: course.stops.length })}
              </span>
              <span className="home-row">
                <Icon name="walk" size={14} />
                {t('home.minutes', { count: WALK_MIN })}
              </span>
            </span>
          </span>
        </button>
        <button
          type="button"
          className="home-hub home-hub--lock"
          onClick={soon}
          data-testid="hub-station"
        >
          <HubArt kind="station" />
          <Pill tone="ink" className="home-hub__soon">
            {t('common.comingSoon')}
          </Pill>
          <span className="home-hub__info">
            <span className="home-h-m">{t('home.hubStation')}</span>
            <span className="home-xs home-hub__sub">{t('home.hubStationSub')}</span>
          </span>
        </button>
        <button
          type="button"
          className="home-hub home-hub--lock"
          onClick={soon}
          data-testid="hub-yuseong"
        >
          <HubArt kind="yuseong" />
          <Pill tone="ink" className="home-hub__soon">
            {t('common.comingSoon')}
          </Pill>
          <span className="home-hub__info">
            <span className="home-h-m">{t('home.hubYuseong')}</span>
            <span className="home-xs home-hub__sub">{t('home.hubYuseongSub')}</span>
          </span>
        </button>
      </div>

      <button type="button" className="home-banner" onClick={soon} data-testid="overnight-banner">
        <span className="home-banner__icon" aria-hidden="true">
          {'♨'}
        </span>
        <span className="home-banner__body">
          <span className="home-banner__k">
            {t('home.overnightKicker')}
            {' · '}
            {t('common.comingSoon').toLocaleUpperCase(lang)}
          </span>
          <span className="home-banner__t">{t('home.overnightTitle')}</span>
        </span>
        <Icon name="forward" size={18} />
      </button>

      <div className="home-sec">
        <h2 className="home-h-m">{t('home.todayCourse')}</h2>
      </div>
      <CardButton className="home-course" onClick={toCourse} data-testid="today-course">
        <span className="home-course__title">{pickL10n(lang, course.title)}</span>
        <span className="home-s">
          {t('course.meta', {
            stops: course.stops.length,
            km: course.distanceKm,
            hours: Math.round((course.durationMin / 60) * 10) / 10,
          })}
        </span>
        <ol className="home-course__stops">
          {stops.map((p) => (
            <li key={p.id}>
              <span className="home-course__no" aria-hidden="true">
                {p.order}
              </span>
              {pickL10n(lang, p.name)}
            </li>
          ))}
        </ol>
      </CardButton>

      {todayPhrase && (
        <>
          <div className="home-sec">
            <h2 className="home-h-m">{t('home.todayPhrase')}</h2>
          </div>
          <div className="ui-card home-phrase" data-testid="today-phrase">
            <div className="home-phrase__body">
              <div className="home-phrase__ko" lang="ko">
                {todayPhrase.ko}
              </div>
              <div className="home-s home-phrase__sub">
                <Pronunciation roman={todayPhrase.roman} kana={todayPhrase.kana} />
                {' · '}
                {pickL10n(lang, todayPhrase.meaning)}
              </div>
            </div>
            <ListenButton text={todayPhrase.ko} onPlay={onPlay} />
          </div>
        </>
      )}
      <div className="home-end" />
    </section>
  );
}
