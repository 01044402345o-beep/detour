// 시나리오 6: 제보 → 리포트의 내 기기 제보 건수 +1
import { KO, LANGS, chooseLanguage, expect, openPlace, test, tr } from './support';

for (const lang of LANGS) {
  test(`S6 제보 → 내 기기 제보 +1 [${lang}]`, async ({ page }) => {
    await chooseLanguage(page, lang);
    await page.goto('./#/report');
    await expect(page.getByTestId('device-reports')).toHaveText(KO.deviceReports(0));

    await page.goto('./#/');
    await page.getByTestId('hub-downtown').click();
    await openPlace(page, lang, 'ssd');
    await page.getByRole('button', { name: tr(lang, 'report.open') }).click();
    const sheet = page.getByRole('dialog', { name: tr(lang, 'report.title') });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('report-sheet-place')).toContainText(
      tr(lang, 'place.unverified'),
    );

    // 실제 브라우저에서 Tab 순환이 시트 안에 머무는지 (T2.0 '남은 것': ReportSheet로 1회 확인)
    const inside = () => sheet.evaluate((el) => el.contains(document.activeElement));
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await inside()).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await inside()).toBe(true);

    await sheet.locator('[data-kind="price"]').click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText(tr(lang, 'report.thanks'))).toBeVisible();

    await page.goto('./#/report');
    await expect(page.getByTestId('device-reports')).toHaveText(KO.deviceReports(1));
    await page.reload();
    await expect(page.getByTestId('device-reports')).toHaveText(KO.deviceReports(1));
  });
}
