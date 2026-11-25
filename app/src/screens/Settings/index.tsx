/**
 * S12 설정 (T2.1 → T6.6 DESIGN.md 6·7장).
 * - 언어 즉시 전환(store setLang → 앱 전체 문구가 바로 바뀜, 저장되어 새로고침 후 유지).
 *   같은 name의 네이티브 radio라 방향키 이동·순환·단일 Tab 진입은 브라우저 기본 동작(R1 M-01)
 * - 사진 출처(T6.6): 새 경로 없이 설정 안의 시트. 목록은 data/photos.ts에서 읽음
 *   (라이선스명·저작자·제목·변경 내역은 데이터 그대로, 라벨만 번역 키).
 *   열 때 같은 주소로 기록 한 칸을 쌓아(history.state 그대로 → 라우터 key 동일, screen_view 중복 없음)
 *   휴대폰 뒤로가기가 화면을 떠나지 않고 시트만 닫게 합니다.
 * - 시연 도구(T6.6, 기본 접힘): 운영자 리포트(S13) 진입, 데모 데이터 초기화(확인 시트 → resetData
 *   → 언어 선택 화면에서 시연을 처음부터). 관광객 주 경로에서 분리(DESIGN.md 6장)
 * - 오프라인 준비 완료 표시(T3.1): 서비스 워커 프리캐시 목록이 전부 캐시됐을 때만 보임 (sw/pwa.ts)
 * - 하단: 가게 정보 정정·삭제 안내와 연락처 자리(PRD 10장, 값은 contact.ts)
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bundles, getPlace } from '../../data';
import { PHOTOS, photoUrl, type Photo } from '../../data/photos';
import { DEFAULT_LANG, pickL10n, useT } from '../../i18n';
import { LANG_NAMES } from '../../i18n/langNames';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { ensureOfflineCheck, usePwaStore } from '../../sw/pwa';
import { LANGS, type Lang } from '../../types';
import { Button, Icon, Pill, Sheet, cx, useToast } from '../../ui';
import { TAKEDOWN_CONTACT } from './contact';
import './settings.css';

/** 사진이 찍힌 장소 이름: 장소 id(코스 정류장·출발지) → 데이터 이름, 권역 사진 → 번역 키 */
function usePhotoPlace() {
  const t = useT();
  return (photo: Photo, lang: Lang): string => {
    if (photo.placeId) {
      const place = getPlace(photo.placeId);
      if (place) return pickL10n(lang, place.name);
      const start = bundles.find((b) => b.course.start.id === photo.placeId)?.course.start;
      if (start) return pickL10n(lang, start.name);
    }
    if (photo.areaId) return t(`settings.photoArea.${photo.areaId}`);
    return photo.title;
  };
}

/** 원본 파일 페이지 주소 → 파일 이름 (예: File:Sungsimdang 2019.jpg). 데이터에서 만든 값이라 번역하지 않음 */
function sourceFileName(url: string): string {
  const name = url.split('/wiki/')[1];
  return name ? decodeURIComponent(name).replace(/_/g, ' ') : url;
}

/** 외부 링크 (새 탭). 글자는 데이터(라이선스명) 또는 번역 라벨 */
function ExtLink({ href, children, testId }: { href: string; children: string; testId?: string }) {
  return (
    <a className="set-cr__link" href={href} target="_blank" rel="noopener noreferrer" data-testid={testId}>
      <span>{children}</span>
      <Icon name="external" size={14} />
    </a>
  );
}

function PhotoCredits({ lang }: { lang: Lang }) {
  const t = useT();
  const placeOf = usePhotoPlace();
  return (
    <>
      <p className="set-cr__scope">{t('photo.licenseScope')}</p>
      <ul className="set-cr" data-testid="photo-credits">
        {PHOTOS.map((p) => (
          <li key={p.id} className="set-cr__item" data-photo-id={p.id} data-photo-kind={p.kind}>
            <div className="set-cr__head">
              {/* 같은 정보(장소 이름)가 바로 옆 글자로 있으므로 빈 alt */}
              <img
                className="set-cr__thumb"
                src={photoUrl(p)}
                alt=""
                width={64}
                height={48}
                loading="lazy"
                decoding="async"
              />
              <div className="set-cr__name">
                <h3 className="set-cr__place">{placeOf(p, lang)}</h3>
                {/* 음식 예시 사진(T6.9): 그 가게에서 찍은 사진이 아님 */}
                {p.kind === 'dish-example' && (
                  <p className="set-cr__kind" data-testid="credit-dish-example">
                    {t('photo.dishExampleOf', { dish: pickL10n(lang, p.dish) })}
                  </p>
                )}
              </div>
            </div>
            <dl className="set-cr__dl">
              <dt>{t('settings.photoTitle')}</dt>
              <dd lang="en">{p.title}</dd>
              <dt>{t('photo.author')}</dt>
              <dd lang="en">
                {p.author}
                {p.year !== undefined && `, ${p.year}`}
              </dd>
              <dt>{t('photo.license')}</dt>
              <dd lang="en">
                <ExtLink href={p.licenseUrl} testId="credit-license">
                  {p.licenseId}
                </ExtLink>
              </dd>
              <dt>{t('photo.original')}</dt>
              <dd lang="en">
                <ExtLink href={p.sourceUrl} testId="credit-source">
                  {sourceFileName(p.sourceUrl)}
                </ExtLink>
              </dd>
              {p.notice && (
                <>
                  <dt>{t('photo.notice')}</dt>
                  <dd lang="en">{p.notice}</dd>
                </>
              )}
              <dt>{t('photo.changes')}</dt>
              <dd lang="en" className="set-cr__changes">
                {p.changes}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * 사진 출처 시트의 열림 상태 + 뒤로가기 연결.
 * 열 때 현재 기록을 그대로 복사해 한 칸 쌓고(주소·라우터 key 동일), 뒤로가기(popstate)면 시트만 닫습니다.
 * 닫기 버튼·Esc·바탕 탭으로 닫으면 쌓은 칸을 history.back()으로 되돌립니다.
 */
function useBackClosableSheet() {
  const [open, setOpen] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onPop = () => {
      pushed.current = false;
      setOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);

  const show = () => {
    window.history.pushState(window.history.state, '', window.location.href);
    pushed.current = true;
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
  };
  return { open, show, hide };
}

export default function SettingsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const lang = useAppStore((s) => s.lang) ?? DEFAULT_LANG;
  const setLang = useAppStore((s) => s.setLang);
  const resetData = useAppStore((s) => s.resetData);
  const offlineReady = usePwaStore((s) => s.offlineReady);
  // 설정 화면 진입 시 준비 판정을 다시 확인 (T3.1 R2: 판정 시점 누락 방지)
  useEffect(() => ensureOfflineCheck(), []);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const credits = useBackClosableSheet();
  const demoId = useId();

  const doReset = () => {
    resetData();
    setConfirmOpen(false);
    toast(t('settings.resetDone'));
    navigate(PATHS.lang, { replace: true });
  };

  return (
    <section className="screen set-screen" data-testid="screen-settings">
      <h1 className="set-title">{t('settings.title')}</h1>

      <div className="set-body">
        <h2 className="set-label" id="set-lang">
          {t('settings.language')}
        </h2>
        <div className="set-group set-langs" role="radiogroup" aria-labelledby="set-lang">
          {LANGS.map((code) => {
            const on = code === lang;
            return (
              <label
                key={code}
                lang={code === 'zh' ? 'zh-Hans' : code}
                className={cx('set-opt', on && 'set-opt--on')}
                data-testid={`set-lang-${code}`}
              >
                <input
                  type="radio"
                  name="set-lang"
                  value={code}
                  checked={on}
                  onChange={() => setLang(code)}
                  className="sr-only"
                />
                <Pill tone="line" className="set-opt__badge" aria-hidden="true">
                  {LANG_NAMES[code].badge}
                </Pill>
                <span className="set-opt__name">{LANG_NAMES[code].name}</span>
                {on && <Icon name="check" size={20} className="set-opt__check" />}
              </label>
            );
          })}
        </div>

        <div className="set-group">
          <button
            type="button"
            className="set-row"
            onClick={credits.show}
            data-testid="open-photo-credits"
          >
            <Icon name="info" size={20} className="set-row__icon" />
            <span className="set-row__text">
              <span className="set-row__name">{t('photo.credits')}</span>
              <span className="set-row__sub">{t('settings.photoCreditsSub')}</span>
            </span>
            <Icon name="forward" size={18} className="set-row__chev" />
          </button>
        </div>

        <ul className="set-notes">
          <li>
            <Icon name="lock" size={16} />
            <span>{t('settings.privacy')}</span>
          </li>
          {offlineReady && (
            <li className="set-notes__ok" data-testid="offline-ready">
              <Icon name="check" size={16} />
              <span>{t('pwa.offlineReady')}</span>
            </li>
          )}
        </ul>

        <div className="set-group set-demo">
          <button
            type="button"
            className="set-row set-demo__toggle"
            aria-expanded={demoOpen}
            aria-controls={demoId}
            onClick={() => setDemoOpen((v) => !v)}
            data-testid="demo-tools"
          >
            <Icon name="settings" size={20} className="set-row__icon" />
            <span className="set-row__name">{t('settings.demoTools')}</span>
            <Icon name="forward" size={18} className="set-row__chev set-demo__chev" />
          </button>
          <div id={demoId} className="set-demo__panel" hidden={!demoOpen}>
            {demoOpen && (
              <>
                <p className="set-demo__note">{t('settings.demoToolsNote')}</p>
                <button
                  type="button"
                  className="set-row"
                  onClick={() => navigate(PATHS.report)}
                  data-testid="open-report"
                >
                  <Icon name="flag" size={20} className="set-row__icon" />
                  <span className="set-row__name">{t('settings.operatorReport')}</span>
                  <Icon name="forward" size={18} className="set-row__chev" />
                </button>
                <button
                  type="button"
                  className="set-row"
                  onClick={() => setConfirmOpen(true)}
                  data-testid="reset-data"
                >
                  <Icon name="refresh" size={20} className="set-row__icon" />
                  <span className="set-row__name">{t('settings.reset')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="set-takedown" data-testid="takedown">
          <p>{t('place.takedown')}</p>
          {TAKEDOWN_CONTACT && (
            <p className="set-takedown__contact" data-testid="takedown-contact">
              {TAKEDOWN_CONTACT}
            </p>
          )}
        </div>
      </div>

      <Sheet open={credits.open} onClose={credits.hide} title={t('photo.credits')}>
        <PhotoCredits lang={lang} />
      </Sheet>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('settings.reset')}>
        <p className="set-confirm__body">{t('settings.resetConfirm')}</p>
        <div className="set-confirm__actions">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="ink" onClick={doReset} data-testid="reset-confirm">
            {t('settings.reset')}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
