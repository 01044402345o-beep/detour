/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 배포 URL: https://01044402345o-beep.github.io/detour/ (PRD 8장)
const BASE = '/detour/';

/**
 * manifest는 public/manifest.webmanifest(정적 파일)를 씁니다. 플러그인 manifest 생성을 끄면 <link>도
 * 빠지므로 여기서 index.html에 manifest·apple-touch-icon 링크를 넣습니다 (T3.1).
 */
function manifestLinks(): Plugin {
  return {
    name: 'detour-manifest-links',
    transformIndexHtml() {
      return [
        {
          tag: 'link',
          attrs: { rel: 'manifest', href: `${BASE}manifest.webmanifest` },
          injectTo: 'head',
        },
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', href: `${BASE}icons/apple-touch-icon.png` },
          injectTo: 'head',
        },
      ];
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    manifestLinks(),
    // PWA·오프라인 (T3.1, PRD 7장): 직접 쓴 서비스 워커(src/sw/sw.ts)에 프리캐시 목록을 주입합니다.
    // 프리캐시 = 빌드 산출물 전체(앱 셸 + 사전·원도심 JSON·SVG 약도가 든 JS 청크 + 아이콘·manifest).
    // OSM 타일은 외부 요청이라 목록에 없고, 워커에도 라우트를 두지 않습니다.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false, // 등록은 src/sw/pwa.ts(startPwa)가 앱 시작 시 합니다
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{html,js,css,svg,png,webmanifest}'],
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
