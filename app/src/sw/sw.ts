/// <reference lib="webworker" />
/**
 * 서비스 워커 (T3.1, PRD 7장 '설치 없음'·F-오프라인).
 * - 프리캐시: 빌드 산출물 전체(앱 셸 HTML·JS·CSS·아이콘·manifest). 3개 언어 사전(en/ja/zh.json)과
 *   원도심 JSON(downtown.json), SVG 약도(SketchMap)는 import로 JS 청크에 들어가 있으므로 함께 프리캐시됩니다.
 * - OSM 타일은 라우트를 두지 않아 캐시하지 않습니다(네트워크 전용, 실패 시 앱이 약도로 전환).
 * - 웹 글꼴(Google Fonts·Pretendard CDN)은 런타임 캐시 — 오프라인에서 글꼴만 빠져도 화면은 열립니다.
 * - 첫 설치: clientsClaim으로 열린 페이지를 바로 제어합니다.
 * - 업데이트: registerType 'prompt' — 새 워커는 대기하고, 페이지가 SKIP_WAITING을 보내면 교체합니다.
 * - PRECACHE_STATUS 메시지: 프리캐시 목록을 캐시에서 하나씩 확인해 {total, cached}로 답합니다
 *   ("오프라인 준비 완료" 조건 = 전부 캐시됨).
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import {
  MSG_PRECACHE_STATUS,
  MSG_SKIP_WAITING,
  MSG_WORKER_ACTIVATED,
  type PrecacheStatus,
} from './messages';

declare let self: ServiceWorkerGlobalScope;

const MANIFEST = self.__WB_MANIFEST;
const PRECACHE_URLS = MANIFEST.map((e) => (typeof e === 'string' ? e : e.url));

precacheAndRoute(MANIFEST);
cleanupOutdatedCaches();
// 첫 설치 때 이미 열린 페이지도 바로 이 워커가 맡습니다 — "오프라인 준비 완료"를 본 뒤 새로고침 없이
// 네트워크가 끊겨도 아직 안 연 화면(지연 로딩 청크)이 캐시에서 열립니다.
// 업데이트 때는 새 워커가 SKIP_WAITING 전까지 대기하므로(토스트) 이 호출이 교체를 앞당기지 않습니다.
clientsClaim();

// HashRouter라 문서 요청은 /detour/ 또는 /detour/index.html 뿐 — 오프라인에서도 앱 셸로 답합니다.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// 글꼴 CSS: 캐시 먼저 보여 주고 뒤에서 갱신
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.endsWith('.css')),
  new StaleWhileRevalidate({
    cacheName: 'detour-font-css',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// 글꼴 파일: 바뀌지 않으므로 캐시 우선
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.gstatic.com' ||
    (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.endsWith('.woff2')),
  new CacheFirst({
    cacheName: 'detour-font-files',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

async function precacheStatus(): Promise<PrecacheStatus> {
  const hits = await Promise.all(PRECACHE_URLS.map(async (u) => !!(await matchPrecache(u))));
  return { total: PRECACHE_URLS.length, cached: hits.filter(Boolean).length };
}

self.addEventListener('message', (event) => {
  const type = (event.data as { type?: unknown } | null)?.type;
  if (type === MSG_SKIP_WAITING) {
    void self.skipWaiting();
  } else if (type === MSG_PRECACHE_STATUS) {
    const port = event.ports[0];
    if (!port) return;
    event.waitUntil(
      precacheStatus().then(
        (s) => port.postMessage(s),
        () => port.postMessage({ total: PRECACHE_URLS.length, cached: 0 } satisfies PrecacheStatus),
      ),
    );
  }
});

// 활성화(= 프리캐시 설치 완료) 뒤 열린 페이지 모두에 알림 — 페이지가 준비 판정 시점을 놓치지 않게 합니다 (R2)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => clients.forEach((c) => c.postMessage({ type: MSG_WORKER_ACTIVATED }))),
  );
});
