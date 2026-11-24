/** S04 이용 방법·문장 탭 (F-04): 단계 안내, 영업시간·길찾기, 문장 듣기·연습 */
import { useNavigate } from 'react-router-dom';
import type { ContentPlace } from '../../data';
import { pickL10n, useLang, useT } from '../../i18n';
import { phraseInput } from '../../router/navState';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { Card, Icon, ListenButton, Pronunciation, useToast } from '../../ui';
import { googlePlaceUrl, naverWalkUrl } from '../../ui/map/externalMap';
import { closedDaysLabel } from './hours';
import { warnIfDropped } from './log';

export function HowTab({ place }: { place: ContentPlace }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const closed = closedDaysLabel(place.closedOn, lang);
  const onDir = () => toast(t('place.dirToast'));
  return (
    <div className="how-tab">
      <ol className="steps">
        {place.steps.map((s, i) => (
          <li key={i} className="step">
            <span className="step__n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="step__t">{pickL10n(lang, s)}</span>
          </li>
        ))}
      </ol>
      <Card className="hours-card">
        <div className="hours-card__row">
          <div>
            <div className="hours-card__k">{t('place.hours')}</div>
            <div className="hours-card__v">{place.hours}</div>
            {closed && <div className="hours-card__k">{t('place.closedOn', { days: closed })}</div>}
          </div>
          <a
            className="dir-btn"
            href={naverWalkUrl(place)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDir}
            data-testid="dir-naver"
          >
            <Icon name="pin" size={16} />
            {t('place.directions')}
          </a>
        </div>
        <a
          className="dir-sub"
          href={googlePlaceUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDir}
          data-testid="dir-google"
        >
          <Icon name="external" size={14} />
          {t('place.googleMaps')}
        </a>
        <p className="dir-hint" data-testid="dir-hint">
          {t('place.dirHint')}
        </p>
      </Card>
    </div>
  );
}

export function PhrasesTab({ place }: { place: ContentPlace }) {
  const lang = useLang();
  const navigate = useNavigate();
  const logEvent = useAppStore((s) => s.logEvent);
  return (
    <div className="phr-tab">
      {place.phrases.map((ph, i) => (
        <Card key={ph.id} className="prow" data-testid={`phrase-${ph.id}`}>
          <button
            type="button"
            className="prow__main"
            onClick={() => navigate(PATHS.practice, { state: phraseInput('phrase', ph.id) })}
          >
            <span className="prow__ko" lang="ko">
              {ph.ko}
            </span>
            <Pronunciation roman={ph.roman} kana={ph.kana} className="prow__pr" />
            <span className="prow__mn">{pickL10n(lang, ph.meaning)}</span>
          </button>
          <span className="prow__play">
            <ListenButton
              text={ph.ko}
              showNotice={i === 0}
              onPlay={() =>
                warnIfDropped(
                  logEvent({
                    type: 'phrase_play',
                    src: 'phrase',
                    placeId: place.id,
                    phraseId: ph.id,
                  }),
                  'phrase_play',
                )
              }
            />
          </span>
        </Card>
      ))}
    </div>
  );
}
