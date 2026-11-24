import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { bundles } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { PATHS } from '../../router/routes';
import { phraseInput } from '../../router/navState';
import { useAppStore } from '../../store/useAppStore';
import { IconButton, ListenButton, Pronunciation, cx, useToast } from '../../ui';
import { logOrWarn } from './logOrWarn';
import './Phrases.css';

/**
 * S10 문장 모음 (F-12·F-13, 목업 R.phrases).
 * 코스별(원도심·전통시장, T5.1)로 장소 문장을 보여 주고, 듣기(phrase_play)·연습 시작·문장 북마크를 합니다.
 */
export default function PhrasesScreen() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const savedPhrases = useAppStore((s) => s.saved.phrases);
  const toggleSavedPhrase = useAppStore((s) => s.toggleSavedPhrase);
  const logEvent = useAppStore((s) => s.logEvent);

  // 연습 버튼 이름은 보이는 글자(문장·발음·뜻) 그대로 두고, '연습' 동작은 설명으로 붙입니다
  // (WCAG 2.5.3 Label in Name — aria-label로 이름을 덮어쓰지 않음, T3.2 측정)
  const practiceHintId = useId();

  const toggle = (phraseId: string) => {
    const on = toggleSavedPhrase(phraseId);
    toast(t(on ? 'saved.savedToast' : 'saved.removedToast'));
  };

  return (
    <section className="screen phr" data-testid="screen-phrases">
      <header className="phr-head">
        <h1 className="phr-title">{t('phrases.title')}</h1>
        <span id={practiceHintId} hidden>
          {t('phrases.practice')}
        </span>
      </header>
      {bundles.map(({ course, places }, bi) => (
        <section
          key={course.id}
          className="phr-course"
          aria-labelledby={`phr-c-${course.id}`}
          data-course-id={course.id}
        >
          <h2 className="phr-course__title" id={`phr-c-${course.id}`}>
            {pickL10n(lang, course.title)}
          </h2>
          {places.map((place) => (
            <section key={place.id} className="phr-sec" aria-labelledby={`phr-${place.id}`}>
              <h3 className="phr-sec__head" id={`phr-${place.id}`}>
                <span className={cx('phr-no', `phr-no--${place.category}`)} aria-hidden="true">
                  {place.order}
                </span>
                {pickL10n(lang, place.name)}
              </h3>
              <ul className="phr-list">
                {place.phrases.map((ph) => {
                  const saved = savedPhrases.includes(ph.id);
                  return (
                    <li key={ph.id} className="ui-card phr-row" data-phrase-id={ph.id}>
                      <button
                        type="button"
                        className="phr-row__main"
                        aria-describedby={practiceHintId}
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
                        showNotice={bi === 0 && place.order === 1 && ph === place.phrases[0]}
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
      ))}
    </section>
  );
}
