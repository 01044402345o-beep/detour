/**
 * Phase 2 E2E 공용 도우미. 선택자는 data-testid·role 우선(reviews/T2.0_usage.md).
 * 문구 비교는 앱 사전(src/i18n/*.json)을 읽어 언어별 기대값을 만듭니다(앱 소스는 읽기만).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';
import { installSpeechMock, type SpeechMockOptions } from './speechMock';

export const LANGS = ['en', 'ja', 'zh'] as const;
export type Lang = (typeof LANGS)[number];

const here = dirname(fileURLToPath(import.meta.url));
const dicts: Record<Lang, Record<string, unknown>> = Object.fromEntries(
  LANGS.map((l) => [l, JSON.parse(readFileSync(join(here, `../src/i18n/${l}.json`), 'utf8'))]),
) as Record<Lang, Record<string, unknown>>;

/** 사전 값 (점 경로 키, `{name}` 채움) */
export function tr(lang: Lang, key: string, params: Record<string, string | number> = {}): string {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dicts[lang]);
  if (typeof v !== 'string') throw new Error(`missing i18n key ${lang}:${key}`);
  return v.replace(/\{(\w+)\}/g, (w, n: string) => (n in params ? String(params[n]) : w));
}

/** 한국어 고정 문구 (src/i18n/staffKo.ts·operatorKo.ts 값과 같음 — 바뀌면 E2E가 잡아냄) */
export const KO = {
  noteOrder: '직원분께: 외국인 손님의 주문입니다',
  noteRequest: '직원분께: 외국인 손님의 요청입니다',
  replyPrompt: '직원분 응답',
  replies: { yes: '네', sold: '품절이에요', wait: '잠시만요', pay: '계산대에서 결제해 주세요' },
  reportTitle: '운영자 리포트 — 원도심',
  deviceReports: (n: number) => `정보 제보 ${n}건`,
};

type Fixtures = { speech: SpeechMockOptions; pageErrors: string[] };

/**
 * - `speech`: 음성 목 설정 (test.use({ speech: { stt: 'denied' } }))
 * - `pageErrors`: 잡히지 않은 페이지 예외. 테스트 끝에 0건이어야 합니다.
 */
export const test = base.extend<Fixtures>({
  speech: [{ stt: 'success', transcript: '' }, { option: true }],
  pageErrors: [
    async ({ page, speech }, use, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') info.annotations.push({ type: 'console-error', description: m.text() });
      });
      await installSpeechMock(page, speech);
      await use(errors);
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** 첫 실행 → /lang 리다이렉트 → 언어 선택 → 시작하기 → 홈 */
export async function chooseLanguage(page: Page, lang: Lang): Promise<void> {
  await page.goto('./');
  await expect(page.getByTestId('screen-lang')).toBeVisible();
  await page.getByTestId(`lang-${lang}`).click();
  await expect(page.getByRole('button', { name: tr(lang, 'lang.start') })).toBeVisible();
  await page.getByRole('button', { name: tr(lang, 'lang.start') }).click();
  await expect(page.getByTestId('screen-home')).toBeVisible();
}

/** 하단 탭바 이동 */
export async function tab(page: Page, lang: Lang, key: 'explore' | 'course' | 'phrases' | 'saved' | 'me') {
  await page.getByRole('navigation').getByRole('link', { name: tr(lang, `nav.${key}`) }).click();
}

/** 코스 지도(탭바) → 정류장 목록에서 장소 열기 */
export async function openPlace(page: Page, lang: Lang, placeId: string): Promise<void> {
  if (!(await page.getByTestId('screen-course').isVisible())) {
    // 탭바는 탭 화면(홈·코스·문장·저장·설정)에만 있음 — 없으면 코스 경로로 직접 이동
    if (await page.getByRole('navigation').isVisible()) await tab(page, lang, 'course');
    else await page.goto('./#/course');
  }
  await expect(page.getByTestId('screen-course')).toBeVisible();
  await page.getByTestId(`stop-${placeId}`).click();
  await expect(page.getByTestId('screen-place')).toBeVisible();
}

/** 메뉴 카드의 + (처음 담기·수량 증가 공통 aria-label "<증가> · <메뉴명>") */
export async function addMenu(page: Page, lang: Lang, menuId: string, times = 1): Promise<void> {
  const card = page.getByTestId(`menu-${menuId}`);
  for (let i = 0; i < times; i++) {
    await card.getByRole('button', { name: tr(lang, 'menu.increase') }).click();
  }
}

/** 장소 화면 주문 바 → 내 주문 */
export async function openOrder(page: Page): Promise<void> {
  await page.getByTestId('orderbar').click();
  await expect(page.getByTestId('screen-order')).toBeVisible();
}

/** 성심당 튀김소보로 2 · 판타롱부추빵 1 → 내 주문 (시나리오 1 공통) */
export async function buildSsdOrder(page: Page, lang: Lang): Promise<void> {
  await page.getByTestId('hub-downtown').click();
  await openPlace(page, lang, 'ssd');
  await addMenu(page, lang, 'tw', 2);
  await addMenu(page, lang, 'bu', 1);
  await openOrder(page);
}

export const SSD_ORDER = {
  ko: '튀김소보로 두 개, 판타롱부추빵 한 개 주세요.',
  roman: ['du gae', 'han gae'],
  kana: ['トゥ ゲ', 'ハン ゲ'],
};
