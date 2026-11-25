/**
 * 시즌 행사 카드 (T5.1, 야시장·축제 일정 안내). 코스 화면 지도 아래에 둡니다.
 * T6.3: 새 색 체계, 작은 대문자 머리말(season.kicker)은 쓰지 않음(키는 남겨 둠).
 * 일정은 행사 공지 기준 참고값이라, 지금 상태(열림·오늘·다음 개장일·시즌 종료)와 함께
 * "방문 전 확인" 안내를 항상 붙입니다.
 * 화면을 열어 둔 채 개장·마감·날짜가 바뀌어도 맞도록 1분마다, 그리고 화면으로 돌아올 때 다시 계산합니다(R1 M-2).
 */
import { useEffect, useState } from 'react';
import { pickL10n, useLang, useT } from '../../i18n';
import type { Lang, SeasonEvent } from '../../types';
import { Card, Icon, Pill } from '../../ui';
import { closedDaysLabel } from '../Place/hours';
import { seasonStatus, type SeasonStatus } from './season';

function fmtDate(lang: Lang, date: string, weekday = false): string {
  return new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
    ...(weekday ? { weekday: 'short' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** 갱신 간격 (ms) */
export const SEASON_TICK_MS = 60_000;

/** 지금 시각. 1분마다·화면 복귀 때 갱신 */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, SEASON_TICK_MS);
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

export function SeasonCard({ event, now }: { event: SeasonEvent; now?: Date }) {
  const t = useT();
  const lang = useLang();
  const clock = useNow();
  const status: SeasonStatus = seasonStatus(event, now ?? clock);
  const hours = event.hours.replace('-', '–');
  const days = closedDaysLabel(event.days, lang) ?? '';

  let state: string;
  switch (status.kind) {
    case 'open':
      state = t('season.open', { close: hours.split('–')[1] });
      break;
    case 'today':
      state = t('season.today', { hours });
      break;
    case 'next':
      state = t('season.next', { date: fmtDate(lang, status.date, true), hours });
      break;
    case 'upcoming':
      state = t('season.upcoming', { date: fmtDate(lang, status.date, true) });
      break;
    default:
      state = t('season.ended', { date: fmtDate(lang, event.endDate) });
  }

  return (
    <Card className="season" data-testid={`season-${event.id}`} data-status={status.kind}>
      <div className="season__head">
        <h3 className="season__title">
          <Icon name="clock" size={18} />
          {pickL10n(lang, event.name)}
        </h3>
        {status.kind === 'open' && <Pill tone="acc">{t('season.openPill')}</Pill>}
      </div>
      <p className="season__desc">{pickL10n(lang, event.description)}</p>
      <dl className="season__rows">
        <div>
          <dt>{t('season.whenLabel')}</dt>
          <dd>
            {t('season.schedule', {
              days,
              hours,
              start: fmtDate(lang, event.startDate),
              end: fmtDate(lang, event.endDate),
            })}
          </dd>
        </div>
        <div>
          <dt>{t('season.whereLabel')}</dt>
          <dd>{pickL10n(lang, event.where)}</dd>
        </div>
      </dl>
      <p className="season__state" role="status">
        {state}
      </p>
      <p className="season__note">{t('season.note')}</p>
    </Card>
  );
}
