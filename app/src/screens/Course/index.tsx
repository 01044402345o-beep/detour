/**
 * S02 코스 (T2.2, PRD F-03 → T6.3 DESIGN.md 7장 '코스', 시안 mockup/redesign/c2-course).
 * - 제목·요약(정류장·km·시간·출발) → 지도(Leaflet + OSM 밝게, 실패·오프라인 → SVG 약도, ui/map)
 *   → 시즌 카드 → 정류장 목록(출발지 + 정류장, 사진 썸네일 또는 글자 타일, 분·영업시간 고정폭, 세로 노선)
 *   → 확인 전 안내(DESIGN.md 6장 정책) + 사진 출처 + 앱이 없을 때 대체 경로 → 아래 고정 길찾기 버튼.
 * - 확인 전 안내: 정류장이 모두 미확인이면 코스에 요약 한 줄, 그 밖(모두 확인·혼합)은 정류장마다 확인일/미확인.
 * - 핀·목록 → 장소 상세. place_view는 장소 상세(T2.3)가 기록하므로 여기서는 남기지 않습니다.
 * - 길찾기 버튼: 방문 기록이 없으면 "Start with stop 1", 있으면 다음 정류장(nextStop) 네이버 지도 도보 길찾기.
 *   T6.13(사용자 요청 2026-11-26): 버튼 위 '행선지' 선택(정류장 번호·이름 라디오)으로 가고 싶은 곳을 고르면
 *   버튼 문구·네이버 도보 길찾기 목적지·Google 장소 보기가 그곳으로 바뀝니다. 처음 선택은 다음 정류장.
 *   T6.14: 'Next' 앰버 알약은 사용자 요청으로 삭제(다음 정류장은 처음 선택으로만 드러남).
 *   보조로 Google Maps 장소 보기·앱이 없을 때 안내.
 * - 음성 가이드(T6.14): 제목 아래 '코스 가이드 듣기' → 팝업에서 화면 언어로 읽고 글도 보여 줌(ui/GuidePlayer).
 * - 코스 여러 개(T5.1): `/course?c=<코스 id>`. 없거나 모르는 id면 기본 코스(원도심).
 */
import { useId, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bundles, getBundle, type CourseBundle } from '../../data';
import { isDishExample, isOwnPhoto, photoForPlace, photoUrl, type Photo } from '../../data/photos';
import { pickL10n, useLang, useT } from '../../i18n';
import { PATHS, placePath } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { GuidePlayer, Icon, IconButton, TopBar } from '../../ui';
import { COURSE_GUIDES } from '../../data/guides';
import { CourseMap, type MapLeg, type MapStop } from '../../ui/map';
import { googlePlaceUrl, naverWalkUrl } from '../../ui/map/externalMap';
import { nextStopIndex } from './nextStop';
import { SeasonCard } from './SeasonCard';
import { tileText, withNums } from './text';
import './Course.css';

/** 지도에 그릴 도보 경로: 구간을 이어 한 줄로 (구간 이음매의 중복 정류장 좌표는 한 번만) */
const ROUTES = new Map(
  bundles.map((b) => [
    b.course.id,
    b.route.legs.flatMap((leg, i) => (i === 0 ? leg.path : leg.path.slice(1))),
  ]),
);

/** 하루 종일 여는 곳(거리 등)은 영업시간을 따로 보이지 않습니다 */
const ALL_DAY = '00:00–24:00';

function fmtHours(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/** 사진 출처 목록: 라이선스별로 저작자를 묶어 "A, B (CC BY-SA 4.0), C (CC BY-SA 2.5)" */
function creditList(photos: readonly Photo[]): string {
  const groups = new Map<string, string[]>();
  for (const p of photos) {
    const authors = groups.get(p.licenseId) ?? [];
    if (!authors.includes(p.author)) authors.push(p.author);
    groups.set(p.licenseId, authors);
  }
  return [...groups].map(([license, authors]) => `${authors.join(', ')} (${license})`).join(', ');
}

export default function CourseScreen() {
  const [params] = useSearchParams();
  const b = getBundle(params.get('c') ?? '') ?? bundles[0];
  // 코스가 바뀌면 지도·목록을 새로 그립니다
  return <CourseView key={b.course.id} bundle={b} />;
}

/** 정류장 썸네일: 사진(옆에 이름이 있으므로 빈 alt) 또는 파란 글자 타일 */
function Thumb({ photo, nameKo, no }: { photo?: Photo; nameKo: string; no?: number }) {
  return (
    <span
      className={`course-thumb${photo ? '' : ' course-thumb--tile'}`}
      data-testid="course-thumb"
      data-kind={photo ? 'photo' : 'tile'}
      data-photo-kind={photo?.kind}
      aria-hidden="true"
    >
      {photo ? (
        <img src={photoUrl(photo)} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="course-thumb__tile" lang="ko">
          {tileText(nameKo)}
        </span>
      )}
      {no !== undefined && <span className="course-thumb__no num">{no}</span>}
    </span>
  );
}

function CourseView({ bundle }: { bundle: CourseBundle }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const events = useAppStore((s) => s.events);
  const { course, places: STOPS, route } = bundle;
  const ROUTE = ROUTES.get(course.id);

  const mapStops = useMemo<MapStop[]>(
    () =>
      STOPS.map((p, i) => ({
        id: p.id,
        no: i + 1,
        name: pickL10n(lang, p.name),
        category: p.category,
        geo: p.geo,
      })),
    [lang, STOPS],
  );

  const mapStart = useMemo(
    () => ({ label: t('course.mapStation'), geo: course.start.geo }),
    [t, course.start.geo],
  );

  // 구간 분 칩: 구간의 도착 정류장 도보 시간
  const mapLegs = useMemo<MapLeg[]>(
    () =>
      route.legs.flatMap((leg) => {
        const p = STOPS.find((s) => s.id === leg.to);
        return p
          ? [{ path: leg.path, label: t('course.minShort', { min: p.walkMinFromPrev }) }]
          : [];
      }),
    [route.legs, STOPS, t],
  );

  const open = (id: string) => navigate(placePath(id));
  const title = pickL10n(lang, course.title);

  // 확인 전 안내 (DESIGN.md 6장)
  // 반복 제거는 '모두 미확인'일 때만(코스에 한 줄). 확인된 곳이 하나라도 있으면 정류장마다
  // 확인일/미확인을 그대로 보입니다 — 장소마다 확인일이 다를 수 있음 (R1 M-1, PRD F-03).
  const noneVerified = STOPS.every((p) => !p.verified);

  const startPhoto = photoForPlace(course.start.id);
  const usedPhotos = [startPhoto, ...STOPS.map((p) => photoForPlace(p.id))].filter(
    (p): p is Photo => !!p,
  );
  // 장소 사진과 음식 예시 사진(그 가게 사진 아님, T6.9)은 출처 줄을 나눠 표시
  // 운영자 직접 촬영(T6.10, CC 아님)은 위키미디어 출처 줄과 따로
  const ownPhotos = usedPhotos.filter((p) => isOwnPhoto(p));
  const placePhotos = usedPhotos.filter((p) => !isDishExample(p) && !isOwnPhoto(p));
  const dishPhotos = usedPhotos.filter(isDishExample);

  const next = nextStopIndex(course.stops, events);
  // 사용자가 고른 행선지(정류장 id). 고르기 전에는 다음 정류장을 따라갑니다
  // 저장소에 둬서 상세 왕복에도 유지, 데모 초기화로 비워짐 (T6.13 R1·R2 M-01)
  const picked = useAppStore((s) => s.walkPicks[course.id] ?? null);
  const setWalkPick = useAppStore((s) => s.setWalkPick);
  const setPicked = (id: string) => setWalkPick(course.id, id);
  const pickedIdx = picked ? STOPS.findIndex((p) => p.id === picked) : -1;
  // 행선지 선택 칸 펼침 (T6.18, 저장하지 않음: 화면을 다시 열면 접힌 상태)
  const [pickOpen, setPickOpen] = useState(false);
  const pickId = useId();
  const target = pickedIdx >= 0 ? pickedIdx : next;
  const nextPlace = STOPS[target];
  const nextNo = target + 1;
  const isFirstStart = target === 0 && next === 0;

  return (
    <section className="screen course" data-testid="screen-course">
      <TopBar
        title={t('nav.course')}
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

      <header className="course-head">
        <h2 className="course-head__title">{title}</h2>
        <p className="course-head__meta" data-testid="course-meta">
          {withNums(
            t('course.meta', {
              stops: STOPS.length,
              km: course.distanceKm.toFixed(1),
              hours: fmtHours(course.durationMin),
            }),
          )}
          {' · '}
          <b>{t('course.metaFrom', { start: t('course.mapStation') })}</b>
        </p>
        {/* T6.14 코스 음성 가이드 */}
        {COURSE_GUIDES[course.id] && (
          <GuidePlayer
            guide={COURSE_GUIDES[course.id]}
            title={title}
            buttonLabel={t('guide.courseButton')}
            testId="course-guide"
            className="course-head__guide"
          />
        )}
      </header>

      <CourseMap
        stops={mapStops}
        onSelect={open}
        label={title}
        route={ROUTE}
        start={mapStart}
        legs={mapLegs}
      />

      {course.events?.map((ev) => (
        <SeasonCard key={ev.id} event={ev} />
      ))}

      <div className="course-line">
        <div className="course-origin" data-testid="course-origin">
          <Thumb photo={startPhoto} nameKo={course.start.nameKo} />
          <span className="course-origin__body">
            <b className="course-stop__name">{pickL10n(lang, course.start.name)}</b>
            <span className="course-stop__sub">
              <span lang="ko">{course.start.nameKo}</span>
              {course.start.hint && ` · ${pickL10n(lang, course.start.hint)}`}
            </span>
          </span>
          <span className="course-origin__tag">{t('course.startTag')}</span>
        </div>

        <ol className="course-stops">
          {STOPS.map((p, i) => {
            const walk =
              i === 0
                ? [
                    t('course.walkFromStart', {
                      min: p.walkMinFromPrev,
                      start: t('course.mapStation'),
                    }),
                    ...(course.start.hint ? [pickL10n(lang, course.start.hint)] : []),
                  ].join(' · ')
                : t('course.walkMin', { min: p.walkMinFromPrev });
            const photo = photoForPlace(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="course-stop"
                  data-testid={`stop-${p.id}`}
                  onClick={() => open(p.id)}
                >
                  <Thumb photo={photo} nameKo={p.nameKo} no={i + 1} />
                  <span className="course-stop__body">
                    <span className="sr-only">
                      {t('course.stopOf', { n: i + 1, total: STOPS.length })}
                    </span>
                    <b className="course-stop__name">{pickL10n(lang, p.name)}</b>
                    <span className="course-stop__sub">
                      <span lang="ko">{p.nameKo}</span> · {pickL10n(lang, p.areaLocal)}
                    </span>
                    {/* 음식 예시 사진(T6.9 R1 M-01): 썸네일은 aria-hidden이라 이름 아래 글자로 알림 */}
                    {photo && isDishExample(photo) && (
                      <span className="course-stop__dish" data-testid={`dish-note-${p.id}`}>
                        {t('photo.dishExample')}
                      </span>
                    )}
                    {!noneVerified && (
                      <span
                        className={`course-stop__check${p.verified ? ' is-verified' : ''}`}
                        data-testid={`check-${p.id}`}
                      >
                        <Icon name={p.verified ? 'check' : 'info'} size={12} strokeWidth={2.5} />
                        {p.verified
                          ? t('course.checked', { date: p.checkedAt })
                          : t('place.unverified')}
                      </span>
                    )}
                    <span className="course-walk sr-only">{walk}</span>
                  </span>
                  <span className="course-stop__time">
                    {/* 이동 시간은 위 sr-only 도보 문구와 같아 낭독기에서만 숨김 (R1 M-2) */}
                    {/* 숫자만 고정폭 — 단위(分钟·分·min)는 본문 글꼴 (T6.7 M-02) */}
                    <b aria-hidden="true">
                      {withNums(t('course.minShort', { min: p.walkMinFromPrev }))}
                    </b>
                    {p.hours !== ALL_DAY && (
                      <span className="num course-stop__hours" data-testid={`hours-${p.id}`}>
                        {/* 낭독기에는 "Hours 08:00–22:00" 한 덩어리로 (보이는 숫자는 같은 내용) */}
                        <span className="sr-only">{`${t('place.hours')} ${p.hours}`}</span>
                        <span aria-hidden="true">{p.hours}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="course-notes">
        {noneVerified && (
          <p className="course-note" data-testid="course-unverified">
            <Icon name="info" size={14} />
            {t('place.unverified')}
          </p>
        )}
        {placePhotos.length > 0 && (
          <p className="course-credit" data-testid="course-photo-credit">
            {t('course.photoCredits', { list: creditList(placePhotos) })}
          </p>
        )}
        {ownPhotos.length > 0 && (
          <p className="course-credit" data-testid="course-own-credit">
            {t('photo.creditOwn')}
          </p>
        )}
        {dishPhotos.length > 0 && (
          <p className="course-credit" data-testid="course-dish-credit">
            {t('photo.dishCredits', { list: creditList(dishPhotos) })}
          </p>
        )}
        {nextPlace && (
          <>
            <p className="course-noapp" data-testid="course-noapp">
              {t('course.noApp')}
            </p>
            <a
              className="course-google"
              href={googlePlaceUrl(nextPlace)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="google-maps"
            >
              <Icon name="external" size={14} />
              {t('course.googleMaps', { n: nextNo })}
            </a>
          </>
        )}
      </div>

      {nextPlace && (
        <div className="course-dock">
          {/* 행선지 선택 (T6.18): 평소엔 한 줄 버튼(지금 행선지 표시), 누르면 위로 펼쳐지고 다시 누르면 접힘 */}
          <button
            type="button"
            className="course-pick__toggle"
            aria-expanded={pickOpen}
            aria-controls={pickId}
            onClick={() => setPickOpen((v) => !v)}
            data-testid="walk-pick-toggle"
          >
            <Icon name="walk" size={18} className="course-pick__toggle-icon" />
            <span className="course-pick__toggle-text">
              <span className="course-pick__toggle-label">{t('course.pickLabel')}</span>
              <span className="course-pick__toggle-value" data-testid="walk-pick-current">
                <span className="num">{nextNo}</span> · {pickL10n(lang, nextPlace.name)}
              </span>
            </span>
            <Icon name="forward" size={18} className="course-pick__chev" />
          </button>
          <fieldset className="course-pick" id={pickId} hidden={!pickOpen} data-testid="walk-pick">
            <legend className="course-pick__legend sr-only">{t('course.pickLabel')}</legend>
            <div className="course-pick__row">
              {STOPS.map((p, i) => (
                <label
                  key={p.id}
                  className={`course-pick__opt${i === target ? ' is-on' : ''}`}
                  data-testid={`pick-${p.id}`}
                >
                  <input
                    type="radio"
                    name={`walk-to-${course.id}`}
                    value={p.id}
                    checked={i === target}
                    // 낭독: "Stop 2 of 4, 전체 이름" — 화면의 이름은 한 줄 말줄임이라 전체 이름을 직접 줌 (R1 L-03)
                    aria-label={[
                      t('course.stopOf', { n: i + 1, total: STOPS.length }),
                      pickL10n(lang, p.name),
                    ].join(', ')}
                    onChange={() => setPicked(p.id)}
                    className="sr-only"
                  />
                  <span className="course-pick__no num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="course-pick__name">{pickL10n(lang, p.name)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <a
            className="ui-btn ui-btn--ink course-dock__btn"
            href={naverWalkUrl(nextPlace)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="start-walking"
          >
            {isFirstStart ? t('course.startWalk') : t('course.walkToStop', { n: nextNo })}
            <Icon name="forward" size={20} />
          </a>
          <p className="course-dock__hint" data-testid="walk-hint">
            {t('course.dirTo', { n: nextNo, name: pickL10n(lang, nextPlace.name) })}
          </p>
        </div>
      )}
    </section>
  );
}
