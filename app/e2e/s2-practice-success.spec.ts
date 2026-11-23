// 시나리오 2: 연습 → (STT 목) 성공 → 결과 점수 → 직원에게 보여주기 → "품절이에요" → 손님 언어 → 주문 수정
import { KO, LANGS, SSD_ORDER, buildSsdOrder, chooseLanguage, expect, test, tr } from './support';

test.use({ speech: { stt: 'success', transcript: SSD_ORDER.ko } });

for (const lang of LANGS) {
  test(`S2 연습 성공 → 품절 → 주문 수정 [${lang}]`, async ({ page }) => {
    await chooseLanguage(page, lang);
    await buildSsdOrder(page, lang);

    await page.getByRole('button', { name: tr(lang, 'order.practice') }).click();
    await expect(page.getByTestId('screen-practice')).toBeVisible();
    await expect(page.getByText(tr(lang, 'practice.voiceNotice'))).toBeVisible();
    await page.getByRole('button', { name: tr(lang, 'practice.micStart') }).click();

    await expect(page.getByTestId('screen-result')).toBeVisible();
    await expect(page.getByTestId('result-score')).toHaveText('100');
    await expect(page.getByRole('heading', { name: tr(lang, 'result.great') })).toBeVisible();

    await page.getByRole('button', { name: tr(lang, 'result.instead') }).click();
    await expect(page.getByTestId('screen-staff')).toBeVisible();
    await expect(page.getByTestId('staff-note')).toContainText(KO.noteOrder);
    await expect(page.getByTestId('staff-sentence')).toHaveText(SSD_ORDER.ko);

    await page.locator('[data-reply="sold"]').click();
    await expect(page.getByTestId('screen-reply')).toBeVisible();
    await expect(page.getByTestId('reply-ko')).toContainText(KO.replies.sold);
    await expect(page.getByTestId('reply-title')).toHaveText(tr(lang, 'reply.soldTitle'));

    await page.getByRole('button', { name: tr(lang, 'reply.edit') }).click();
    await expect(page.getByTestId('screen-place')).toBeVisible();
    await expect(page.getByRole('tab', { name: tr(lang, 'place.tabMenu') })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('menu-tw').locator('.qty__n')).toHaveText('2');
  });
}
