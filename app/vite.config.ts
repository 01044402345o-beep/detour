/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 배포 URL: https://01044402345o-beep.github.io/detour/ (PRD 8장)
const BASE = '/detour/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    // PWA 세부 설정(오프라인 캐시·업데이트 토스트)은 T3.1에서 채웁니다.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Daejeon Detour',
        short_name: 'Detour',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#fbf7ef',
        theme_color: '#ee6a3c',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
