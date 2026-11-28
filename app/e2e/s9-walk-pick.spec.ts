// T6.18 → T6.19 행선지 버튼: 실제 배치 확인 — 평소엔 'Where do you want to walk?' 버튼 하나,
// 누르면 정류장 2×2 + 네이버 지도 길찾기 버튼이 버튼 위로 올라오고(버튼 위치 그대로), 다시 누르면 내려감.
// 처음 행선지는 1번(시장 코스도), Tab 순서는 버튼 → 팝업.
import { chooseLanguage, expect, tab, test, tr } from './support';

for (const course of ['downtown', 'market'] as const) {
  test(`S9 행선지 버튼: 위로 팝업·내려감, 버튼 위치 유지, 처음 1번 [${course}]`, async ({
    page,
  }) => {
    await chooseLanguage(page, 'en');
    if (course === 'market') await page.goto('./#/course?c=jungang-market');
    else await tab(page, 'en', 'course');
    const toggle = page.getByTestId('walk-pick-toggle');
    const panel = page.getByTestId('walk-panel');
    const walk = page.getByTestId('start-walking');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toContainText(tr('en', 'course.pickLabel'));
    await expect(toggle).toContainText(tr('en', 'course.pickHint'));
    await expect(panel).toBeHidden();
    await expect(walk).toBeHidden();

    const tBefore = (await toggle.boundingBox())!;
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(walk).toBeVisible();
    // 처음 행선지 = 1번
    await expect(walk).toHaveText(new RegExp(tr('en', 'course.startWalk')));
    await page.waitForTimeout(400); // 펼침 애니메이션(0.2초) 뒤 위치 비교
    const tOpen = (await toggle.boundingBox())!;
    const pOpen = (await panel.boundingBox())!;
    const wOpen = (await walk.boundingBox())!;
    expect(Math.abs(tOpen.y - tBefore.y)).toBeLessThan(1);
    // 팝업(정류장·길찾기 버튼)은 버튼 위
    expect(pOpen.y + pOpen.height).toBeLessThanOrEqual(tOpen.y + 1);
    expect(wOpen.y + wOpen.height).toBeLessThanOrEqual(tOpen.y + 1);
    const vw = page.viewportSize()!.width;
    expect(pOpen.x).toBeGreaterThanOrEqual(0);
    expect(pOpen.x + pOpen.width).toBeLessThanOrEqual(vw);

    // 키보드: 버튼을 Enter로 접었다 펴도 초점은 버튼, Tab → 고른 라디오 → 길찾기 링크 (T6.19 R1 L-02)
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('walk-pick').getByRole('radio', { checked: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(walk).toBeFocused();

    // Google 장소 보기는 팝업 밖 본문
    const google = page.getByTestId('google-maps');
    expect(await google.evaluate((el) => !!el.closest('[data-testid="walk-panel"]'))).toBe(false);

    // 3번을 고르면 길찾기 버튼이 3번으로
    await page.getByTestId('walk-pick').getByRole('radio').nth(2).check({ force: true });
    await expect(walk).toHaveText(new RegExp(tr('en', 'course.walkToStop', { n: 3 })));

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await expect(google).toBeAttached();
    expect(await google.evaluate((el) => !!el.closest('[data-testid="walk-panel"]'))).toBe(false);
    const tAfter = (await toggle.boundingBox())!;
    expect(Math.abs(tAfter.y - tBefore.y)).toBeLessThan(1);
  });
}
