// 시나리오 4: 광천식당 — 포장 토글 숨김, 오징어두루치기(가격 미확인) 담기 → "총액 확인 필요"
import { LANGS, addMenu, chooseLanguage, expect, openOrder, openPlace, test, tr } from './support';

for (const lang of LANGS) {
  test(`S4 광천식당 총액 확인 필요 [${lang}]`, async ({ page }) => {
    await chooseLanguage(page, lang);
    await page.getByTestId('hub-downtown').click();
    await openPlace(page, lang, 'gwc');

    await expect(page.getByTestId('menu-od')).toContainText(tr(lang, 'menu.priceTbd'));
    await addMenu(page, lang, 'od');
    await expect(page.getByTestId('orderbar')).toContainText(tr(lang, 'menu.totalTbd'));

    await openOrder(page);
    await expect(page.getByTestId('order-ko')).toHaveText('오징어두루치기 1인분 주세요.');
    await expect(page.getByTestId('order-total')).toHaveText(tr(lang, 'menu.totalTbd'));
    await expect(page.getByTestId('line-od')).toContainText(tr(lang, 'menu.priceTbd'));
    // takeout:false → 포장/매장 전환 숨김, 매장 고정 표시
    await expect(page.getByRole('radio', { name: tr(lang, 'order.togo') })).toHaveCount(0);
    await expect(page.getByTestId('dine-in-only')).toHaveText(tr(lang, 'order.dineInOnly'));
  });
}
