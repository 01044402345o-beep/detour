import { useState } from 'react';
import { Link } from 'react-router-dom';
import { places } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { placePath } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { Icon, IconButton, ListenButton, Pronunciation, useToast } from '../../ui';
import { ReportSheet } from '../../ui/ReportSheet';
import { logOrWarn } from '../Phrases/logOrWarn';
import './Saved.css';

/**
 * S11 저장 · 제보 (F-13·F-14, 목업 R.saved → T6.6 흰 목록·선 구분, 빈 화면 저장 방법 안내).
 * 저장한 장소·문장 목록(데이터 순서), 저장 해제, "정보가 달라요" 제보 시트.
 * 저장 목록은 store(persist)에 있으므로 새로고침 뒤에도 유지됩니다.
 */
export default function SavedScreen() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const saved = useAppStore((s) => s.saved);
  const toggleSavedPlace = useAppStore((s) => s.toggleSavedPlace);
  const toggleSavedPhrase = useAppStore((s) => s.toggleSavedPhrase);
  const logEvent = useAppStore((s) => s.logEvent);
  const [reportOpen, setReportOpen] = useState(false);

  // 데이터에 없는 ID(이전 버전 저장값 등)는 표시하지 않습니다.
  const savedPlaces = places.filter((p) => saved.places.includes(p.id));
  const savedPhrases = places.flatMap((p) =>
    p.phrases.filter((ph) => saved.phrases.includes(ph.id)).map((ph) => ({ place: p, ph })),
  );
  const empty = savedPlaces.length === 0 && savedPhrases.length === 0;

  return (
    <section className="screen sav" data-testid="screen-saved">
      <header className="sav-head">
        <h1 className="sav-title">{t('saved.title')}</h1>
      </header>
      <div className="sav-body">
        {empty && (
          <div className="sav-empty" data-testid="saved-empty">
            <p className="sav-empty__title">{t('saved.empty')}</p>
            {/* 저장 방법 안내 (T6.6): 장소·문장 화면의 저장(북마크) 버튼 모양을 함께 보여 줌 */}
            <div className="sav-empty__how" aria-hidden="true">
              <span className="sav-empty__icon">
                <Icon name="bookmark" size={22} />
              </span>
              <span className="sav-empty__cap">{t('saved.emptyIcon')}</span>
            </div>
            <p className="sav-empty__hint">{t('saved.emptyHint')}</p>
          </div>
        )}

        {savedPlaces.length > 0 && (
          <section aria-labelledby="sav-places">
            <h2 className="sav-sec" id="sav-places">
              {t('saved.places')}
            </h2>
            <ul className="sav-list">
              {savedPlaces.map((p) => (
                <li key={p.id} className="sav-row" data-place-id={p.id}>
                  <span className="sav-no num" aria-hidden="true">
                    {p.order}
                  </span>
                  <Link className="sav-row__main" to={placePath(p.id)}>
                    <b className="sav-name">{pickL10n(lang, p.name)}</b>
                    <span className="sav-meta">
                      <span lang="ko">{p.nameKo}</span> ·{' '}
                      {p.verified
                        ? t('course.checked', { date: p.checkedAt })
                        : t('place.unverified')}
                    </span>
                  </Link>
                  <IconButton
                    icon="bookmark"
                    className="sav-bm"
                    label={t('place.unsave')}
                    aria-pressed
                    onClick={() => {
                      toggleSavedPlace(p.id);
                      toast(t('saved.removedToast'));
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {savedPhrases.length > 0 && (
          <section aria-labelledby="sav-phrases">
            <h2 className="sav-sec" id="sav-phrases">
              {t('nav.phrases')}
            </h2>
            <ul className="sav-list">
              {savedPhrases.map(({ place, ph }, i) => (
                <li key={ph.id} className="sav-row" data-phrase-id={ph.id}>
                  <div className="sav-row__main">
                    <span className="sav-name sav-ko" lang="ko">
                      {ph.ko}
                    </span>
                    <span className="sav-meta">
                      <Pronunciation roman={ph.roman} kana={ph.kana} /> ·{' '}
                      {pickL10n(lang, ph.meaning)}
                    </span>
                  </div>
                  <IconButton
                    icon="bookmark"
                    className="sav-bm"
                    label={t('place.unsave')}
                    aria-pressed
                    onClick={() => {
                      toggleSavedPhrase(ph.id);
                      toast(t('saved.removedToast'));
                    }}
                  />
                  <ListenButton
                    text={ph.ko}
                    className="sav-play"
                    showNotice={i === 0}
                    onPlay={() =>
                      logOrWarn(logEvent, {
                        type: 'phrase_play',
                        src: 'phrase',
                        placeId: place.id,
                        phraseId: ph.id,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <button type="button" className="sav-report" onClick={() => setReportOpen(true)}>
          <Icon name="flag" size={20} className="sav-report__icon" />
          <span className="sav-report__label">{t('report.open')}</span>
          <Icon name="forward" size={18} className="sav-chev" />
        </button>
      </div>
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </section>
  );
}
