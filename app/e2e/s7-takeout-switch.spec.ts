// 시나리오 7: 성심당 포장 선택 → 광천식당으로 전환 → 문장에 "포장해 주세요" 없음
import { LANGS, addMenu, chooseLanguage, expect, openOrder, openPlace, test, tr } from './support';

for (const lang of LANGS) {
  test(`S7 포장 → 광천식당 전환 시 포장 문구 없음 [${lang}]`, async ({ page }) => {
    await chooseLanguage(page, lang);
    await page.getByTestId('hub-downtown').click();
    await openPlace(page, lang, 'ssd');
    await addMenu(page, lang, 'tw', 1);
    await openOrder(page);

    const togo = page.getByRole('radio', { name: tr(lang, 'order.togo') });
    await togo.click();
    await expect(togo).toHaveAttribute('aria-checked', 'true');
    // T1.3 규칙: "{…} 주세요." + 포장 시 " 포장해 주세요."
    await expect(page.getByTestId('order-ko')).toHaveText('튀김소보로 한 개 주세요. 포장해 주세요.');

    await openPlace(page, lang, 'gwc');
    await addMenu(page, lang, 'dt', 1);
    const sheet = page.getByRole('dialog', { name: tr(lang, 'menu.switchTitle') });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: tr(lang, 'menu.switchConfirm') }).click();
    await expect(sheet).toBeHidden();

    await openOrder(page);
    await expect(page.getByTestId('order-ko')).toHaveText('두부두루치기 1인분 주세요.');
    await expect(page.getByTestId('order-ko')).not.toContainText('포장');
    await expect(page.getByTestId('dine-in-only')).toBeVisible();

    await page.getByRole('button', { name: tr(lang, 'order.showStaff') }).click();
    await expect(page.getByTestId('staff-sentence')).not.toContainText('포장');
    await expect(page.getByTestId('staff-takeout')).toHaveCount(0);
  });
}
