/**
 * 라우터 (T2.0): 라우트 13개 + 첫 실행 언어 선택 리다이렉트 + screen_view 기록 + 앱 틀.
 */
import { Suspense, useEffect, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { cx } from '../ui/cx';
import { OVERLAY_ID } from '../ui/overlay';
import { TabBar } from '../ui/TabBar';
import { ToastProvider } from '../ui/Toast';
import { PATHS, ROUTES, routeForPath, screenKeyForPath } from './routes';
import { SCREENS } from './screens';

/** 화면이 바뀔 때마다 screen_view를 화면 키로 1회 기록 (같은 이동을 두 번 세지 않음) */
function ScreenViewLogger() {
  const location = useLocation();
  const logEvent = useAppStore((s) => s.logEvent);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastKey.current === location.key) return;
    lastKey.current = location.key;
    const screen = screenKeyForPath(location.pathname);
    if (!screen) return;
    const ok = logEvent({ type: 'screen_view', screen });
    if (!ok && import.meta.env.DEV) console.warn(`[router] screen_view dropped: ${screen}`);
  }, [location.key, location.pathname, logEvent]);

  return null;
}

/** 앱 틀: 데스크톱에서 폰 폭(430px) 가운데 정렬, /report만 넓게. 탭바·시트·토스트 자리 포함 */
function AppLayout() {
  const { pathname } = useLocation();
  const route = routeForPath(pathname);
  return (
    <div className="app-stage">
      <div
        className={cx('app-frame', route?.wide && 'app-frame--wide')}
        data-testid="app-frame"
        data-wide={route?.wide ? 'true' : 'false'}
      >
        <ToastProvider>
          <main className="app-view" data-testid="app-root">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </main>
          {route?.tabBar && <TabBar />}
          <div id={OVERLAY_ID} className="app-overlay" />
        </ToastProvider>
      </div>
    </div>
  );
}

/** 첫 실행(언어 미선택)이면 어느 경로로 들어와도 /lang으로 */
function LangGate() {
  const lang = useAppStore((s) => s.lang);
  const { pathname } = useLocation();
  if (lang === null && pathname !== PATHS.lang) return <Navigate to={PATHS.lang} replace />;
  return (
    <>
      <ScreenViewLogger />
      <AppLayout />
    </>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<LangGate />}>
        {ROUTES.map((r) => {
          const Screen = SCREENS[r.screen];
          return <Route key={r.screen} path={r.path} element={<Screen />} />;
        })}
        <Route path="*" element={<Navigate to={PATHS.home} replace />} />
      </Route>
    </Routes>
  );
}
