// 데스크톱 1280×800: /report만 (폰 폭 제한 예외, 한국어 고정)
import { KO, LANGS, chooseLanguage, expect, test } from './support';

for (const lang of LANGS) {
  test(`Desktop /report 넓은 화면·한국어 [${lang}]`, async ({ page }) => {
    await chooseLanguage(page, lang);
    // 다른 화면은 430px 폰 폭
    const home = await page.getByTestId('screen-home').boundingBox();
    expect(home!.width).toBeLessThanOrEqual(430);

    await page.goto('./#/report');
    const rep = page.getByTestId('screen-report');
    await expect(rep).toBeVisible();
    await expect(rep).toHaveAttribute('lang', 'ko');
    await expect(rep.getByText(KO.reportTitle)).toBeVisible();
    const box = await rep.boundingBox();
    expect(box!.width).toBeGreaterThan(430);
    await expect(page.getByTestId('sample-kpis')).toBeVisible();
    await expect(page.getByTestId('device-section')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
