// 시나리오 5: 설정 → 언어 변경 → UI 문구 전환 + 한국어 고정 영역 유지 → 운영자 리포트(한국어 유지)
import type { Page } from '@playwright/test';
import {
  KO,
  LANGS,
  type Lang,
  buildSsdOrder,
  chooseLanguage,
  expect,
  openOrder,
  openPlace,
  test,
  tr,
} from './support';

const NEXT: Record<Lang, Lang> = { en: 'ja', ja: 'zh', zh: 'en' };
const EMOJI = /\s*\p{Extended_Pictographic}️?/gu;

/** 내 주문 → 직원 화면: 한국어 안내·응답 버튼은 고정, 손님 언어 문구는 현재 언어 */
async function checkStaffKorean(page: Page, lang: Lang) {
  await page.getByRole('button', { name: tr(lang, 'order.showStaff') }).click();
  await expect(page.getByTestId('screen-staff')).toBeVisible();
  await expect(page.getByTestId('staff-note')).toContainText(KO.noteOrder);
  await expect(page.getByText(KO.replyPrompt)).toBeVisible();
  for (const [k, ko] of Object.entries(KO.replies)) {
    const btn = page.locator(`[data-reply="${k}"]`);
    await expect(btn.locator('[lang="ko"]')).toHaveText(ko);
    const title = tr(lang, `reply.${k}Title`).replace(EMOJI, '').trim();
    await expect(btn.locator('small')).toHaveText(title);
  }
  await expect(page.getByRole('heading', { name: tr(lang, 'order.showStaff') })).toBeVisible();
}

for (const from of LANGS) {
  const to = NEXT[from];
  test(`S5 언어 전환 ${from}→${to}, 한국어 고정 영역 유지 [${from}]`, async ({ page }) => {
    await chooseLanguage(page, from);
    await buildSsdOrder(page, from);
    await checkStaffKorean(page, from);

    // 설정(탭바 Me)에서 언어 변경 → 즉시 전환
    await page.goto('./#/');
    await page.getByRole('navigation').getByRole('link', { name: tr(from, 'nav.me') }).click();
    await expect(page.getByRole('heading', { name: tr(from, 'settings.title') })).toBeVisible();
    await page.getByTestId(`set-lang-${to}`).click();
    await expect(page.getByRole('heading', { name: tr(to, 'settings.title') })).toBeVisible();
    await expect(page.getByTestId(`set-lang-${to}`).getByRole('radio')).toBeChecked();
    await expect(
      page.getByRole('navigation').getByRole('link', { name: tr(to, 'nav.course') }),
    ).toBeVisible();
    await expect(page.getByText(tr(to, 'settings.privacy'))).toBeVisible();

    // 새 언어로 주문 → 직원 화면
    await openPlace(page, to, 'ssd');
    await openOrder(page);
    await expect(page.getByRole('heading', { name: tr(to, 'order.title') })).toBeVisible();
    await expect(page.getByTestId('order-ko')).toHaveText(
      '튀김소보로 두 개, 판타롱부추빵 한 개 주세요.',
    );
    await checkStaffKorean(page, to);

    // 새로고침 후에도 언어 유지
    await page.reload();
    await expect(page.getByRole('heading', { name: tr(to, 'order.showStaff') })).toBeVisible();

    // 운영자 리포트: 언어와 무관하게 한국어
    await page.goto('./#/settings');
    await page.getByTestId('open-report').click();
    const rep = page.getByTestId('screen-report');
    await expect(rep).toBeVisible();
    await expect(rep).toHaveAttribute('lang', 'ko');
    await expect(rep.getByText(KO.reportTitle)).toBeVisible();
    await expect(page.getByTestId('sample-badge')).toBeVisible();
    await expect(page.getByTestId('device-reports')).toHaveText(KO.deviceReports(0));
    await expect(rep).not.toContainText(tr(to, 'settings.operatorReport'));
  });
}
