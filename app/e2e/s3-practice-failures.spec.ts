// 시나리오 3: (STT 목) 미지원/권한 거부/무음/타임아웃 → 직원에게 보여주기 → "네" → 손님 언어 표시
import { KO, LANGS, buildSsdOrder, chooseLanguage, expect, test, tr } from './support';
import type { SttMode } from './speechMock';

const MODES: { mode: SttMode; title: string; body: string; retry: boolean }[] = [
  { mode: 'unsupported', title: 'stt.unsupportedTitle', body: 'stt.unsupported', retry: false },
  { mode: 'denied', title: 'stt.deniedTitle', body: 'stt.denied', retry: true },
  { mode: 'no-speech', title: 'stt.failTitle', body: 'stt.noSpeech', retry: true },
  { mode: 'timeout', title: 'stt.failTitle', body: 'stt.timeout', retry: true },
];

for (const m of MODES) {
  test.describe(`S3 ${m.mode}`, () => {
    test.use({ speech: { stt: m.mode } });
    for (const lang of LANGS) {
      test(`S3 ${m.mode} → 직원 → 네 [${lang}]`, async ({ page }) => {
        await chooseLanguage(page, lang);
        await buildSsdOrder(page, lang);
        await page.getByRole('button', { name: tr(lang, 'order.practice') }).click();
        await expect(page.getByTestId('screen-practice')).toBeVisible();

        const mic = page.getByRole('button', { name: tr(lang, 'practice.micStart') });
        if (m.mode === 'unsupported') await expect(mic).toBeDisabled();
        else await mic.click();

        // 타임아웃은 listening 8초 기한
        await expect(page.getByTestId('practice-status')).toHaveAttribute('data-stt', m.mode, {
          timeout: m.mode === 'timeout' ? 12_000 : 5_000,
        });

        const problem = page.getByTestId('practice-problem');
        await expect(problem).toContainText(tr(lang, m.title));
        await expect(problem).toContainText(tr(lang, m.body));
        await expect(problem.getByRole('button', { name: tr(lang, 'stt.retry') })).toHaveCount(
          m.retry ? 1 : 0,
        );

        await problem.getByRole('button', { name: tr(lang, 'order.showStaff') }).click();
        await expect(page.getByTestId('screen-staff')).toBeVisible();
        await expect(page.getByTestId('staff-note')).toContainText(KO.noteOrder);

        await page.locator('[data-reply="yes"]').click();
        await expect(page.getByTestId('screen-reply')).toBeVisible();
        await expect(page.getByTestId('reply-ko')).toContainText(KO.replies.yes);
        await expect(page.getByTestId('reply-title')).toHaveText(tr(lang, 'reply.yesTitle'));
      });
    }
  });
}
