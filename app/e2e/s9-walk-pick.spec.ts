// T6.18 행선지 선택 접힘 버튼: 실제 배치 확인 — 누르면 2×2가 버튼 위로 펼쳐지고,
// 펼침 전후 버튼·길찾기 버튼 위치는 그대로, 다시 누르면 접힘. Tab 순서는 버튼 → 칸.
import { chooseLanguage, expect, tab, test, tr } from './support';

test('S9 행선지 선택: 버튼 위로 펼침·접힘, 버튼 위치 유지 [en]', async ({ page }) => {
  await chooseLanguage(page, 'en');
  await tab(page, 'en', 'course');
  const toggle = page.getByTestId('walk-pick-toggle');
  const walk = page.getByTestId('start-walking');
  const panel = page.getByTestId('walk-pick');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();

  const tBefore = (await toggle.boundingBox())!;
  const wBefore = (await walk.boundingBox())!;
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  // 펼침 애니메이션(0.2초)이 끝난 뒤 위치 비교
  await page.waitForTimeout(400);
  const tOpen = (await toggle.boundingBox())!;
  const wOpen = (await walk.boundingBox())!;
  const pOpen = (await panel.boundingBox())!;
  expect(Math.abs(tOpen.y - tBefore.y)).toBeLessThan(1);
  expect(Math.abs(wOpen.y - wBefore.y)).toBeLessThan(1);
  expect(pOpen.y + pOpen.height).toBeLessThanOrEqual(tOpen.y + 1);
  // 펼친 칸이 화면 폭 안
  const vw = page.viewportSize()!.width;
  expect(pOpen.x).toBeGreaterThanOrEqual(0);
  expect(pOpen.x + pOpen.width).toBeLessThanOrEqual(vw);

  // Tab 순서: 버튼 → 칸의 선택된 라디오
  await toggle.focus();
  await page.keyboard.press('Tab');
  const focusedInPanel = await page.evaluate(
    () => !!document.activeElement?.closest('[data-testid="walk-pick"]'),
  );
  expect(focusedInPanel).toBe(true);

  // 다른 정류장을 고르면 한 줄 표시·길찾기 버튼이 바뀜
  await page.getByTestId('walk-pick').getByRole('radio').nth(2).check({ force: true });
  await expect(page.getByTestId('walk-pick-current')).toContainText('3 ·');
  await expect(walk).toHaveText(new RegExp(tr('en', 'course.walkToStop', { n: 3 })));

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
  const tAfter = (await toggle.boundingBox())!;
  expect(Math.abs(tAfter.y - tBefore.y)).toBeLessThan(1);
});
