import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlace, places } from '../../data';
import { MAX_EVENTS, extraVisitRate, nextPlaceDistribution, topPhrases } from '../../domain/events';
import { LANG_NAMES } from '../../i18n/langNames';
import { OPERATOR_KO, formatKo } from '../../i18n/operatorKo';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import { IconButton } from '../../ui';
import {
  SAMPLE_HOURS,
  SAMPLE_KPI,
  SAMPLE_LANG,
  SAMPLE_NEXT,
  SAMPLE_OVERNIGHT_PCT,
  SAMPLE_PERIOD,
  SAMPLE_TOP,
  type SampleNext,
} from './sample';
import './Report.css';

/** 내 기기 지표의 기준 장소: 성심당 본점 (task.md T2.6 · T1.6 R1) */
const ANCHOR_PLACE_ID = 'ssd';

const phraseKo = new Map(places.flatMap((p) => p.phrases.map((ph) => [ph.id, ph.ko] as const)));

/** 문장 ID → 한국어 문장 (데이터에 없으면 ID) */
const koOfPhrase = (id: string): string => phraseKo.get(id) ?? id;

/** 장소 ID → 한국어 이름 (데이터에 없으면 ID) */
const koOfPlace = (id: string): string => getPlace(id)?.nameKo ?? id;

/** 정렬 순서: 코스 순서 → 방문 순서 (코스가 여러 개라 order만으로는 겹침, T5.1) */
const placeOrder = (id: string): number => {
  const i = places.findIndex((p) => p.id === id);
  return i >= 0 ? i : Number.MAX_SAFE_INTEGER;
};

const nextLabel = (n: SampleNext): string =>
  'placeId' in n ? koOfPlace(n.placeId) : OPERATOR_KO[n.labelKey];

const fmt = (n: number) => n.toLocaleString('ko-KR');
const width = (v: number): CSSProperties => ({ width: `${v}%` });

/**
 * S13 운영자 리포트 (F-16·F-16a, 목업 renderReport). 한국어 고정(OPERATOR_KO), 언어 설정과 무관.
 * - 위: 예시 데이터("예시 데이터 · 시연용" 표기). 아래: 내 기기 기록 — 예시 데이터와 따로 표시하고 합산하지 않습니다.
 * - 이벤트 기반 지표(추가 방문 비율·다음 방문지·많이 쓴 문장·이용 기록 수)는 최근 MAX_EVENTS(500)건 기준.
 * - 내 기기 제보 건수는 reports.length 기준(이벤트 상한과 무관, report_sent 수로 세지 않음).
 */
export default function ReportScreen() {
  const navigate = useNavigate();
  const events = useAppStore((s) => s.events);
  const reports = useAppStore((s) => s.reports);

  const extra = extraVisitRate(events, ANCHOR_PLACE_ID);
  const next = Object.entries(nextPlaceDistribution(events, ANCHOR_PLACE_ID)).sort(
    // 횟수 내림차순, 같으면 코스 순서
    (a, b) => b[1] - a[1] || placeOrder(a[0]) - placeOrder(b[0]),
  );
  const top = topPhrases(events, 5);
  const maxNext = Math.max(...SAMPLE_NEXT.map((n) => n.pct));
  const basis = formatKo('deviceBasis', { max: MAX_EVENTS });

  const back = () => {
    const idx = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(PATHS.settings, { replace: true });
  };

  return (
    <section className="screen rep" data-testid="screen-report" lang="ko">
      <div className="rep-panel">
        <div className="rep-nav">
          <IconButton icon="back" label={OPERATOR_KO.back} onClick={back} />
        </div>

        <header className="rep-hd">
          <span className="rep-sample" data-testid="sample-badge">
            {OPERATOR_KO.sampleBadge}
          </span>
          <h1 className="rep-title">{OPERATOR_KO.title}</h1>
          <p className="rep-s">{formatKo('subtitle', { period: SAMPLE_PERIOD })}</p>
        </header>

        {/* ───── 예시 데이터 ───── */}
        <div className="rep-kpis" data-testid="sample-kpis">
          <div className="rep-kpi">
            <div className="l">{OPERATOR_KO.kpiUsers}</div>
            <div className="n">{fmt(SAMPLE_KPI.users)}</div>
            <div className="d d--sea">
              {formatKo('kpiUsersDelta', { pct: SAMPLE_KPI.usersDeltaPct })}
            </div>
          </div>
          <div className="rep-kpi">
            <div className="l">{OPERATOR_KO.kpiExtraVisit}</div>
            <div className="n">{`${SAMPLE_KPI.extraVisitPct}%`}</div>
            <div className="d">{OPERATOR_KO.kpiExtraVisitSub}</div>
          </div>
          <div className="rep-kpi">
            <div className="l">{OPERATOR_KO.kpiOrderCards}</div>
            <div className="n">{fmt(SAMPLE_KPI.orderCards)}</div>
            <div className="d">{OPERATOR_KO.kpiOrderCardsSub}</div>
          </div>
          <div className="rep-kpi">
            <div className="l">{OPERATOR_KO.kpiReports}</div>
            <div className="n" data-testid="sample-reports">
              {fmt(SAMPLE_KPI.reports)}
            </div>
            <div className="d d--acc">
              {formatKo('kpiReportsPending', { count: SAMPLE_KPI.reportsPending })}
            </div>
          </div>
        </div>

        <div className="rep-grid">
          <section className="rep-box">
            <h2>{OPERATOR_KO.nextTitle}</h2>
            <p className="s">{OPERATOR_KO.nextSub}</p>
            {SAMPLE_NEXT.map((n) => (
              <div className="rep-hbar" key={'placeId' in n ? n.placeId : n.labelKey}>
                <span>{nextLabel(n)}</span>
                <span className="tr">
                  <i style={{ ...width((n.pct / maxNext) * 84), background: n.color }} />
                </span>
                <span className="v">{`${n.pct}%`}</span>
              </div>
            ))}
          </section>

          <section className="rep-box">
            <h2>{OPERATOR_KO.topTitle}</h2>
            <p className="s">{OPERATOR_KO.topSub}</p>
            <ol className="rep-list">
              {SAMPLE_TOP.map((p, i) => (
                <li key={p.phraseId}>
                  <b>{i + 1}</b>
                  {koOfPhrase(p.phraseId)}
                  <span className="c">{fmt(p.count)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rep-box">
            <h2>{OPERATOR_KO.langTitle}</h2>
            <p className="s">{OPERATOR_KO.langSub}</p>
            <div className="rep-stack" aria-hidden="true">
              {SAMPLE_LANG.map((l) => (
                <i key={l.lang} style={{ ...width(l.pct), background: l.color }} />
              ))}
            </div>
            <div className="rep-legend">
              {SAMPLE_LANG.map((l) => (
                <span key={l.lang}>
                  <i style={{ background: l.color }} />
                  {`${LANG_NAMES[l.lang].name} ${l.pct}%`}
                </span>
              ))}
            </div>
            <h2 className="rep-gap">{OPERATOR_KO.overnightTitle}</h2>
            <p className="s">{OPERATOR_KO.overnightSub}</p>
            <div className="rep-hbar rep-hbar--solo">
              <span className="tr">
                <i style={{ ...width(SAMPLE_OVERNIGHT_PCT), background: 'var(--sea)' }} />
              </span>
              <span className="v">{`${SAMPLE_OVERNIGHT_PCT}%`}</span>
            </div>
          </section>

          <section className="rep-box">
            <h2>{OPERATOR_KO.hourTitle}</h2>
            <p className="s">{OPERATOR_KO.hourSub}</p>
            <div className="rep-cols">
              {SAMPLE_HOURS.map(({ h, v }) => (
                <div key={h} style={{ height: `${v}%` }}>
                  <span>{formatKo('hourLabel', { h })}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ───── 내 기기 기록 (F-16a): 예시 데이터와 합산하지 않음 ───── */}
        <section className="rep-device" data-testid="device-section" aria-labelledby="rep-device">
          <h2 id="rep-device">{OPERATOR_KO.deviceTitle}</h2>
          <p className="s">{OPERATOR_KO.deviceNote}</p>
          <div className="rep-kpis rep-kpis--device">
            <div className="rep-kpi">
              <div className="l">{OPERATOR_KO.kpiReports}</div>
              <div className="n" data-testid="device-reports">
                {formatKo('deviceReports', { count: reports.length })}
              </div>
            </div>
            <div className="rep-kpi">
              <div className="l">{OPERATOR_KO.kpiExtraVisit}</div>
              <div className="n" data-testid="device-extra">
                {extra.rate === null ? '—' : `${Math.round(extra.rate * 100)}%`}
              </div>
              <div className="d">{`${extra.numerator}/${extra.denominator} · ${basis}`}</div>
            </div>
            <div className="rep-kpi">
              <div className="l">{OPERATOR_KO.deviceTitle}</div>
              <div className="n" data-testid="device-events">
                {formatKo('deviceEvents', { count: events.length })}
              </div>
              <div className="d">{basis}</div>
            </div>
          </div>
          <div className="rep-grid">
            <section className="rep-box">
              <h3>{OPERATOR_KO.nextTitle}</h3>
              <p className="s">{basis}</p>
              {next.length === 0 ? (
                <p className="rep-none">—</p>
              ) : (
                <ol className="rep-list" data-testid="device-next">
                  {next.map(([id, n]) => (
                    <li key={id}>
                      {koOfPlace(id)}
                      <span className="c">{fmt(n)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className="rep-box">
              <h3>{OPERATOR_KO.topTitle}</h3>
              <p className="s">{basis}</p>
              {top.length === 0 ? (
                <p className="rep-none">—</p>
              ) : (
                <ol className="rep-list" data-testid="device-top">
                  {top.map((p, i) => (
                    <li key={p.phraseId}>
                      <b>{i + 1}</b>
                      {koOfPhrase(p.phraseId)}
                      <span className="c">{fmt(p.count)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </section>
      </div>
    </section>
  );
}
