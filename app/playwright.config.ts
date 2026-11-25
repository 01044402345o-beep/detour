import { defineConfig } from '@playwright/test';

// Phase 2 E2E (coordinator 담당, task.md 0.1절·Phase 2 E2E).
// - 대상: `npm run build`(base /edulleo/) 후 `vite preview`
// - 브라우저: 설치된 Microsoft Edge(channel msedge). Playwright 브라우저는 내려받지 않습니다.
// - 뷰포트: 기본 390×844(전 시나리오) / 360×780(전 시나리오) / 430×932(시나리오 1·5만) / 데스크톱 1280×800(/report만)
// - 각 시나리오는 3개 언어(en·ja·zh)마다 따로 돌고, 음성(TTS·STT)은 e2e/speechMock.ts의 목을 씁니다.
const mobile = (width: number, height: number) => ({
  channel: 'msedge',
  viewport: { width, height },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'en-US',
  timezoneId: 'Asia/Seoul',
});

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: {
    baseURL: 'http://localhost:4173/edulleo/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Phase 3: 서비스 워커(오프라인 프리캐시) 동작 허용
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/edulleo/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'm390', testIgnore: /report-desktop/, use: mobile(390, 844) },
    { name: 'm360', testIgnore: /report-desktop/, use: mobile(360, 780) },
    { name: 'm430', testMatch: /s(1|5)-.*\.spec\.ts/, use: mobile(430, 932) },
    {
      name: 'desktop',
      testMatch: /report-desktop\.spec\.ts/,
      use: { channel: 'msedge', viewport: { width: 1280, height: 800 }, timezoneId: 'Asia/Seoul' },
    },
  ],
});
