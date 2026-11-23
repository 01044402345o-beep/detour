import { defineConfig, devices } from '@playwright/test';

// Phase 단위 E2E (coordinator 담당). preview 서버를 대상으로 모바일 뷰포트에서 실행합니다.
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4173/detour/',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/detour/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
});
