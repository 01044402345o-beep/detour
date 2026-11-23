import { useNavigate } from 'react-router-dom';
import { course, places } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { PATHS } from '../../router/routes';
import { phraseInput } from '../../router/navState';
import { useAppStore } from '../../store/useAppStore';
import { IconButton, ListenButton, Pronunciation, cx, useToast } from '../../ui';
import { logOrWarn } from './logOrWarn';
import './Phrases.css';

/**
 * S10 문장 모음 (F-12·F-13, 목업 R.phrases).
 * 코스 4곳의 문장을 장소별로 보여 주고, 듣기(phrase_play)·연습 시작·문장 북마크를 합니다.
 */
export default function PhrasesScreen() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const savedPhrases = useAppStore((s) => s.saved.phrases);
  const toggleSavedPhrase = useAppStore((s) => s.toggleSavedPhrase);
  const logEvent = useAppStore((s) => s.logEvent);

  const toggle = (phraseId: string) => {
    const on = toggleSavedPhrase(phraseId);
    toast(t(on ? 'saved.savedToast' : 'saved.removedToast'));
  };

  return (
    <section className="screen phr" data-testid="screen-phrases">
      <header className="phr-head">
        <h1 className="phr-title">{t('phrases.title')}</h1>
        <p className="phr-sub">{pickL10n(lang, course.title)}</p>
      </header>
      {places.map((place) => (
        <section key={place.id} className="phr-sec" aria-labelledby={`phr-${place.id}`}>
          <h2 className="phr-sec__head" id={`phr-${place.id}`}>
            <span className={cx('phr-no', `phr-no--${place.category}`)} aria-hidden="true">
              {place.order}
            </span>
            {pickL10n(lang, place.name)}
          </h2>
          <ul className="phr-list">
            {place.phrases.map((ph) => {
              const saved = savedPhrases.includes(ph.id);
              return (
                <li key={ph.id} className="ui-card phr-row" data-phrase-id={ph.id}>
                  <button
                    type="button"
                    className="phr-row__main"
                    aria-label={`${t('phrases.practice')}: ${ph.ko}`}
                    onClick={() =>
                      navigate(PATHS.practice, { state: phraseInput('phrase', ph.id) })
                    }
                  >
                    <span className="phr-ko" lang="ko">
                      {ph.ko}
                    </span>
                    <span className="phr-meta">
                      <Pronunciation roman={ph.roman} kana={ph.kana} /> ·{' '}
                      {pickL10n(lang, ph.meaning)}
                    </span>
                  </button>
                  <IconButton
                    icon="bookmark"
                    className={cx('phr-bm', saved && 'is-on')}
                    label={t(saved ? 'place.unsave' : 'phrases.save')}
                    aria-pressed={saved}
                    onClick={() => toggle(ph.id)}
                  />
                  <ListenButton
                    text={ph.ko}
                    className="phr-play"
                    showNotice={place.order === 1 && ph === place.phrases[0]}
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
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
