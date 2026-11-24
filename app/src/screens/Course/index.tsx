/**
 * S02 코스 지도 (T2.2, PRD F-03).
 * - 지도: Leaflet + OSM(출처 상시), 실패·오프라인 → SVG 약도 (ui/map)
 * - 정류장 목록: 이동 시간·확인 상태(verified면 확인일, 아니면 "현장 확인 전 · 예시 정보")
 * - 핀·목록 → 장소 상세. place_view는 장소 상세(T2.3)가 기록하므로 여기서는 남기지 않습니다.
 * - Start walking → 다음 정류장의 네이버 지도 웹 도보 길찾기(기본) + Google Maps 장소 보기(보조)
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { course, courseRoute, getPlace } from '../../data';
import type { ContentPlace } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { PATHS, placePath } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { Icon, IconButton, Pill, TopBar } from '../../ui';
import { CourseMap, type MapStop } from '../../ui/map';
import { googlePlaceUrl, naverWalkUrl } from '../../ui/map/externalMap';
import { nextStopIndex } from './nextStop';
import './Course.css';

const STOPS: ContentPlace[] = course.stops.map((id) => {
  const p = getPlace(id);
  if (!p) throw new Error(`course stop "${id}" not found`);
  return p;
});

/** 지도에 그릴 도보 경로: 구간을 이어 한 줄로 (구간 이음매의 중복 정류장 좌표는 한 번만) */
const ROUTE = courseRoute.legs.flatMap((leg, i) => (i === 0 ? leg.path : leg.path.slice(1)));

function fmtHours(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

export default function CourseScreen() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const events = useAppStore((s) => s.events);

  const mapStops = useMemo<MapStop[]>(
    () =>
      STOPS.map((p, i) => ({
        id: p.id,
        no: i + 1,
        name: pickL10n(lang, p.name),
        category: p.category,
        geo: p.geo,
      })),
    [lang],
  );

  const open = (id: string) => navigate(placePath(id));
  const title = pickL10n(lang, course.title);
  const allVerified = STOPS.every((p) => p.verified);
  const latestCheck = STOPS.map((p) => p.checkedAt)
    .sort()
    .at(-1);

  const next = nextStopIndex(course.stops, events);
  const nextPlace = STOPS[next];
  const nextNo = next + 1;

  return (
    <section className="screen course" data-testid="screen-course">
      <TopBar
        title={title}
        backTo={PATHS.home}
        right={
          <IconButton
            icon="chat"
            label={t('nav.phrases')}
            iconSize={18}
            onClick={() => navigate(PATHS.phrases)}
          />
        }
      />

      <CourseMap stops={mapStops} onSelect={open} label={title} route={ROUTE} />

      <div className="course-meta">
        <h2 className="course-meta__title">{title}</h2>
        <p className="course-meta__sub">
          {t('course.meta', {
            stops: STOPS.length,
            km: course.distanceKm.toFixed(1),
            hours: fmtHours(course.durationMin),
          })}
        </p>
        <div className="course-meta__pills">
          {allVerified && latestCheck ? (
            <Pill tone="sea" icon="check">
              {t('course.checked', { date: latestCheck })}
            </Pill>
          ) : (
            <Pill tone="line" icon="info" data-testid="course-unverified">
              {t('place.unverified')}
            </Pill>
          )}
          <Pill tone="line" icon="pin">
            {t('course.from')}
          </Pill>
        </div>
      </div>

      <ol className="course-stops">
        {STOPS.map((p, i) => (
          <li key={p.id}>
            <div className="course-walk">
              <Icon name="walk" size={14} />
              {t('course.walkMin', { min: p.walkMinFromPrev })}
            </div>
            <button
              type="button"
              className="course-stop"
              data-testid={`stop-${p.id}`}
              onClick={() => open(p.id)}
            >
              <span className={`course-stop__n course-stop__n--${p.category}`} aria-hidden="true">
                {i + 1}
              </span>
              <span className="course-stop__body">
                <span className="sr-only">
                  {t('course.stopOf', { n: i + 1, total: STOPS.length })}
                </span>
                <b className="course-stop__name">{pickL10n(lang, p.name)}</b>
                <span className="course-stop__sub">
                  {p.nameKo} · {pickL10n(lang, p.areaLocal)}
                </span>
                <span className="course-stop__pills">
                  <Pill tone={p.category === 'food' ? 'acc' : 'plum'}>
                    {t(p.category === 'food' ? 'place.food' : 'place.sight')}
                  </Pill>
                  {p.orderable && p.menu && (
                    <Pill tone="line">{`${t('place.tabMenu')} ${p.menu.length}`}</Pill>
                  )}
                  <Pill tone="line" icon="chat">
                    {p.phrases.length}
                  </Pill>
                </span>
                <span
                  className={`course-stop__check${p.verified ? ' is-verified' : ''}`}
                  data-testid={`check-${p.id}`}
                >
                  <Icon name={p.verified ? 'check' : 'info'} size={12} strokeWidth={2.5} />
                  {p.verified ? t('course.checked', { date: p.checkedAt }) : t('place.unverified')}
                </span>
              </span>
              <span className="course-stop__chev" aria-hidden="true">
                <Icon name="forward" size={18} />
              </span>
            </button>
          </li>
        ))}
      </ol>

      {nextPlace && (
        <div className="course-actions">
          <a
            className="ui-btn ui-btn--ink"
            href={naverWalkUrl(nextPlace)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="start-walking"
          >
            <Icon name="walk" size={18} />
            {nextNo === 1 ? t('course.startWalk') : t('course.walkToStop', { n: nextNo })}
            <Icon name="forward" size={18} />
          </a>
          <p className="course-actions__hint">{t('course.dirNext', { n: nextNo })}</p>
          <p className="course-actions__noapp" data-testid="course-noapp">
            {t('course.noApp')}
          </p>
          <a
            className="course-actions__google"
            href={googlePlaceUrl(nextPlace)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="google-maps"
          >
            <Icon name="external" size={14} />
            {t('course.googleMaps', { n: nextNo })}
          </a>
        </div>
      )}
    </section>
  );
}
