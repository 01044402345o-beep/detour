// 시나리오 8 (T6.8): 언어를 고른 뒤에도 앱을 다시 열면(홈 주소) 인트로가 먼저 나오고,
// 특정 화면 주소로 열면 그 화면이 바로 열린다.
import { LANGS, chooseLanguage, expect, test, tr } from './support';

for (const lang of LANGS) {
  test(`S8 앱을 열 때마다 인트로 [${lang}]`, async ({ page, context }) => {
    await chooseLanguage(page, lang);

    // 같은 홈 주소로 다시 열기(새로고침) → 인트로, 고른 언어 그대로
    await page.reload();
    await expect(page.getByTestId('screen-lang')).toBeVisible();
    await expect(page.getByTestId(`lang-${lang}`)).toBeChecked();
    await page.getByRole('button', { name: tr(lang, 'lang.start') }).click();
    await expect(page.getByTestId('screen-home')).toBeVisible();

    // 새 탭에서 특정 화면 주소로 열기 → 인트로 없이 그 화면
    const other = await context.newPage();
    await other.goto('./#/course');
    await expect(other.getByTestId('screen-course')).toBeVisible();
    await expect(other.getByTestId('screen-lang')).toHaveCount(0);
    await other.close();
  });
}
