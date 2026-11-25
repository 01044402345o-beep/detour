import { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { useLang } from './i18n';
import { AppRoutes } from './router/AppRoutes';
import { getTts } from './speech/tts';

/** 문서 언어(html lang): 글꼴 대체·줄바꿈·낭독이 화면 언어를 따르게 함 (Phase 6 T6.7) */
const HTML_LANG = { en: 'en', ja: 'ja', zh: 'zh-Hans' } as const;

/**
 * 앱 루트 (T2.0). GitHub Pages(/edulleo/)에서 새로고침해도 열리도록 HashRouter를 씁니다.
 * TTS 계약 ④: 페이지 숨김·이탈 시 자동 취소(bindAutoCancel)는 여기서 1회만 등록합니다.
 */
export default function App() {
  useEffect(() => getTts().bindAutoCancel(), []);
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
  }, [lang]);
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
