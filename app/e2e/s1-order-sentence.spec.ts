// 시나리오 1: 언어 선택 → 홈 → 원도심 → 성심당 → 튀김소보로 2·판타롱부추빵 1 → 내 주문 문장 = T1.3 검수표 기대값
import { LANGS, SSD_ORDER, buildSsdOrder, chooseLanguage, expect, test, tr } from './support';

for (const lang of LANGS) {
  test(`S1 주문 문장 검수표 일치 [${lang}]`, async ({ page }) => {
    await chooseLanguage(page, lang);
    await buildSsdOrder(page, lang);

    await expect(page.getByTestId('order-ko')).toHaveText(SSD_ORDER.ko);
    const card = page.getByTestId('order-card');
    // 발음: EN·ZH 로마자, JA 가타카나 (F-01, 검수표 칸)
    for (const p of lang === 'ja' ? SSD_ORDER.kana : SSD_ORDER.roman) {
      await expect(card).toContainText(p);
    }
    // 품목 줄·수량
    await expect(page.getByTestId('line-tw').locator('.qty__n')).toHaveText('2');
    await expect(page.getByTestId('line-bu').locator('.qty__n')).toHaveText('1');
    // 화면 문구가 선택 언어
    await expect(page.getByRole('heading', { name: tr(lang, 'order.title') })).toBeVisible();
    // 가로 스크롤 없음
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
