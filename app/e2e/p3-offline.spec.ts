// Phase 3 오프라인 시나리오: 설정 "오프라인 준비 완료" 대기 → 네트워크 차단 → 새로고침
// → 미방문 장소 상세·문장 모음·약도(SVG) 표시 (task.md Phase 3 E2E, T3.1)
import type { Page } from '@playwright/test';
import { LANGS, chooseLanguage, expect, tab, test, tr } from './support';

/** 오프라인 상태에서 경로를 열고 문서를 다시 요청(새로고침) — 서비스 워커가 응답해야 함 */
async function openOffline(page: Page, hash: string, testId: string) {
  await page.goto(`./#${hash}`);
  await page.reload();
  await expect(page.getByTestId(testId)).toBeVisible();
}

for (const lang of LANGS) {
  test(`P3 오프라인 새로고침 → 미방문 장소·문장 모음·약도 [${lang}]`, async ({ page, context }) => {
    // 온라인 방문은 lang → home → settings 뿐 (장소·문장·코스는 미방문)
    await chooseLanguage(page, lang);
    await tab(page, lang, 'me');
    await expect(page.getByTestId('screen-settings')).toBeVisible();
    const ready = page.getByTestId('offline-ready');
    try {
      await expect(ready).toBeVisible({ timeout: 30_000 });
    } catch (e) {
      // 진단: 워커 상태와 프리캐시 상태(앱과 같은 메시지로 직접 질의)를 첨부 — 원인 task 보고용
      const diag = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const sw = reg?.active;
        const status = sw
          ? await new Promise((res) => {
              const ch = new MessageChannel();
              const t = setTimeout(() => res('no-reply-15s'), 15_000);
              ch.port1.onmessage = (m) => {
                clearTimeout(t);
                res(m.data);
              };
              sw.postMessage({ type: 'DETOUR_PRECACHE_STATUS' }, [ch.port2]);
            })
          : null;
        return {
          controlled: !!navigator.serviceWorker.controller,
          active: sw?.state ?? null,
          waiting: reg?.waiting?.state ?? null,
          installing: reg?.installing?.state ?? null,
          status,
          readyAfterDiag: !!document.querySelector('[data-testid="offline-ready"]'),
        };
      });
      await test.info().attach('sw-diagnostic', {
        body: JSON.stringify(diag, null, 2),
        contentType: 'application/json',
      });
      console.log('[p3-offline diag]', JSON.stringify(diag));
      throw e;
    }
    await expect(ready).toHaveText(tr(lang, 'pwa.offlineReady'));
    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return { scope: reg?.scope ?? null, controlled: !!navigator.serviceWorker.controller };
    });
    expect(sw.scope).toMatch(/\/detour\/$/);
    expect(sw.controlled).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('screen-settings')).toBeVisible();
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);

    // 미방문 장소 상세 4곳 (언어 유지)
    for (const id of ['ssd', 'eun', 'mus', 'gwc']) {
      await openOffline(page, `/place/${id}`, 'screen-place');
      await expect(page.getByTestId('verified-badge')).toHaveText(tr(lang, 'place.unverified'));
      await expect(page.getByRole('tablist')).toBeVisible();
    }
    // 성심당 메뉴 담기까지 동작
    await openOffline(page, '/place/ssd', 'screen-place');
    await page
      .getByTestId('menu-tw')
      .getByRole('button', { name: tr(lang, 'menu.increase') })
      .click();
    await expect(page.getByTestId('orderbar')).toBeVisible();

    // 문장 모음
    await openOffline(page, '/phrases', 'screen-phrases');
    await expect(page.getByText('포장해 주세요').first()).toBeVisible();

    // 코스: 타일 대신 SVG 약도, 핀 4개
    await openOffline(page, '/course', 'screen-course');
    await expect(page.getByTestId('map-sketch')).toBeVisible();
    await expect(page.getByTestId('map-tiles')).toHaveCount(0);
    await expect(page.getByTestId('map-sketch').locator('[data-testid^="map-pin-"]')).toHaveCount(4);
    await expect(page.getByTestId('map-line')).toBeVisible();
  });
}
