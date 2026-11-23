import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MAX_EVENTS, type AppEvent } from '../../domain/events';
import { OPERATOR_KO, formatKo } from '../../i18n/operatorKo';
import { PATHS } from '../../router/routes';
import { useAppStore } from '../../store/useAppStore';
import type { Lang } from '../../types';
import ReportScreen from './index';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const reportCss = readFileSync(resolve(process.cwd(), 'src/screens/Report/Report.css'), 'utf8');

function renderReport(lang: Lang = 'en') {
  useAppStore.setState({ lang });
  return render(
    <MemoryRouter initialEntries={[PATHS.report]}>
      <ReportScreen />
    </MemoryRouter>,
  );
}

const MIN = 60 * 1000;
const pv = (placeId: string, t: number): AppEvent => ({ type: 'place_view', placeId, t });
const play = (phraseId: string, t: number): AppEvent => ({
  type: 'phrase_play',
  src: 'phrase',
  phraseId,
  t,
});

beforeEach(() => useAppStore.getState().resetData());
afterEach(() => {
  useAppStore.getState().resetData();
  useAppStore.setState({ lang: null });
});

describe('S13 운영자 리포트', () => {
  it.each<Lang>(['en', 'ja', 'zh'])(
    '언어(%s)와 무관하게 한국어 고정 + 예시 데이터 표기',
    (lang) => {
      renderReport(lang);
      const root = screen.getByTestId('screen-report');
      expect(root).toHaveAttribute('lang', 'ko');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(OPERATOR_KO.title);
      expect(screen.getByTestId('sample-badge')).toHaveTextContent('예시 데이터 · 시연용');
      for (const k of ['kpiUsers', 'kpiExtraVisit', 'kpiOrderCards', 'kpiReports'] as const) {
        expect(within(screen.getByTestId('sample-kpis')).getByText(OPERATOR_KO[k])).toBeVisible();
      }
      expect(screen.getByText(OPERATOR_KO.nextTitle, { selector: 'h2' })).toBeInTheDocument();
      expect(screen.getByText(OPERATOR_KO.topTitle, { selector: 'h2' })).toBeInTheDocument();
    },
  );

  it('예시 지표: 다음 방문지(데이터 한국어 이름 + 코스 밖 항목), 많이 쓴 문장(데이터 문장)', () => {
    renderReport();
    for (const name of ['으능정이 문화의거리', '대전근현대사전시관', '광천식당']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(OPERATOR_KO.nextMarket)).toBeInTheDocument();
    expect(screen.getByText(OPERATOR_KO.nextHome)).toBeInTheDocument();
    expect(screen.getByText('포장해 주세요')).toBeInTheDocument();
    expect(screen.getByText('화장실 어디예요?')).toBeInTheDocument();
    expect(screen.getByText('English 52%')).toBeInTheDocument();
  });

  it('내 기기 제보 건수 = reports.length, 예시 제보 수(12)와 합산하지 않음', () => {
    const add = useAppStore.getState().addReport;
    add('menu', 'ssd');
    add('price');
    // 이벤트를 비워도 제보 건수는 reports 기준 (report_sent 수로 세지 않음)
    useAppStore.getState().clearEvents();
    renderReport();
    expect(screen.getByTestId('device-reports')).toHaveTextContent(
      formatKo('deviceReports', { count: 2 }),
    );
    expect(screen.getByTestId('sample-reports')).toHaveTextContent('12');
    expect(screen.getByTestId('device-events')).toHaveTextContent(
      formatKo('deviceEvents', { count: 0 }),
    );
    expect(screen.getByTestId('device-section')).toHaveTextContent(OPERATOR_KO.deviceNote);
  });

  it('기록 없음: 추가 방문 비율·다음 방문지·많이 쓴 문장은 "—"', () => {
    renderReport();
    expect(screen.getByTestId('device-extra')).toHaveTextContent('—');
    expect(screen.queryByTestId('device-next')).not.toBeInTheDocument();
    expect(screen.queryByTestId('device-top')).not.toBeInTheDocument();
  });

  it('내 기기 이벤트 지표: 성심당(ssd) 기준 추가 방문·다음 방문지, 많이 쓴 문장, 최근 500건 기준 표기', () => {
    const t0 = 1_700_000_000_000;
    useAppStore.setState({
      events: [
        // 세션 1: 성심당 → 으능정이
        pv('ssd', t0),
        pv('eun', t0 + MIN),
        play('ssd-2', t0 + 2 * MIN),
        play('ssd-2', t0 + 3 * MIN),
        // 세션 2 (30분 넘게 뒤): 성심당만
        pv('ssd', t0 + 60 * MIN),
        play('gwc-2', t0 + 61 * MIN),
        // 세션 3: 성심당 → 광천식당
        pv('ssd', t0 + 120 * MIN),
        pv('gwc', t0 + 121 * MIN),
      ],
    });
    renderReport();
    expect(screen.getByTestId('device-extra')).toHaveTextContent('67%');
    expect(screen.getByTestId('device-section')).toHaveTextContent('2/3');
    const next = within(screen.getByTestId('device-next')).getAllByRole('listitem');
    expect(next.map((li) => li.textContent)).toEqual(['으능정이 문화의거리1', '광천식당1']);
    const top = within(screen.getByTestId('device-top')).getAllByRole('listitem');
    expect(top.map((li) => li.textContent)).toEqual(['1포장해 주세요2', '2덜 맵게 해 주세요1']);
    expect(screen.getByTestId('device-events')).toHaveTextContent(
      formatKo('deviceEvents', { count: 8 }),
    );
    const basis = formatKo('deviceBasis', { max: MAX_EVENTS });
    expect(basis).toContain('500');
    expect(
      within(screen.getByTestId('device-section')).getAllByText(new RegExp(basis)).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it.each<Lang>(['en', 'ja', 'zh'])('뒤로 버튼 이름은 한국어 고정 (%s, R1 M-01)', (lang) => {
    renderReport(lang);
    expect(screen.getByRole('button', { name: OPERATOR_KO.back })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument();
    for (const other of ['Back', '戻る', '返回']) {
      expect(screen.queryByRole('button', { name: other })).not.toBeInTheDocument();
    }
  });

  it('760px 이하: 1박 막대(두 열)가 모바일 세 열 규칙에 덮이지 않음 (R1 L-01)', () => {
    const mobile = reportCss.slice(reportCss.indexOf('@media (max-width: 760px)'));
    const three = mobile.indexOf('.rep-hbar {');
    const solo = mobile.search(/\.rep-hbar--solo\s*\{\s*grid-template-columns:\s*1fr 40px;/);
    expect(three).toBeGreaterThan(0);
    expect(solo).toBeGreaterThan(three);
  });
});
