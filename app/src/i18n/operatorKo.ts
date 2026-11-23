/**
 * S13 운영자 리포트 한국어 고정 문구 (PRD F-16·F-16a, 목업 S13).
 * S13 운영자 리포트는 한국어 고정(coordinator 결정, 2026-11-23). 언어 전환과 무관합니다.
 * 관광객 화면인 설정의 진입 버튼은 사전 키 settings.operatorReport(다국어)를 씁니다.
 *
 * - `{name}` 자리표시자는 formatKo(key, params)로 채웁니다. 예: formatKo('deviceEvents', { count: 3 }).
 *   누락 시 개발 모드 경고(t()와 같은 규칙). 자리표시자 없는 문구는 OPERATOR_KO.title처럼 상수를 그대로 씁니다.
 * - 장소명 등 콘텐츠는 data JSON의 한국어 이름을 씁니다. 여기에는 코스 밖 항목만 둡니다.
 * - 하드코딩 검사 예외 목록(hardcodeCheck.ts ALLOWED_LITERALS)에 문자열 단위로 들어 있습니다.
 */
import { fillTemplate, type Params } from './format';

export const OPERATOR_KO = {
  sampleBadge: '예시 데이터 · 시연용',
  deviceBasis: '최근 {max}건 기준',
  back: '뒤로',
  title: '운영자 리포트 — 원도심',
  subtitle: '“빵집 다음은 어디였나” · {period} · 대전시·자치구·관광기관 제공용',
  kpiUsers: '이용자 (QR 접속)',
  kpiUsersDelta: '▲ {pct}% 전주 대비',
  kpiExtraVisit: '추가 방문 비율',
  kpiExtraVisitSub: '성심당 이후 1곳 이상 방문',
  kpiOrderCards: '주문 카드 사용',
  kpiOrderCardsSub: '직원에게 보여주기 포함',
  kpiReports: '정보 제보',
  kpiReportsPending: '확인 대기 {count}건',
  kpiReportsJustNow: '+{count} 방금 제보됨',
  nextTitle: '성심당 다음 방문지',
  nextSub: '성심당 방문 이용자의 다음 체크인 장소 (%)',
  nextMarket: '중앙시장 (코스 외)',
  nextHome: '바로 귀가 (대전역)',
  topTitle: '많이 쓴 문장 Top 5',
  topSub: '듣기 + 연습 + 직원에게 보여주기',
  langTitle: '언어별 이용',
  langSub: '첫 실행 시 선택한 언어',
  overnightTitle: '1박 전환 관심',
  overnightSub: '유성 1박 배너 클릭 비율',
  hourTitle: '시간대별 코스 진입',
  hourSub: '원도심 코스 시작 시각',
  hourLabel: '{h}시',
  /** F-16a: 내 기기 기록은 예시 데이터와 따로 표시하고 합산하지 않음 */
  deviceTitle: '내 기기 기록',
  deviceEvents: '이용 기록 {count}건',
  deviceReports: '정보 제보 {count}건',
  deviceNote: '예시 데이터와 따로 표시하며 합산하지 않습니다.',
} as const;

export type OperatorKoKey = keyof typeof OPERATOR_KO;

/** OPERATOR_KO 문구의 자리표시자를 채웁니다. */
export function formatKo(key: OperatorKoKey, params?: Params): string {
  return fillTemplate(OPERATOR_KO[key], params, `OPERATOR_KO.${key}`);
}
