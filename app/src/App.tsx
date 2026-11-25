import { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './router/AppRoutes';
import { getTts } from './speech/tts';

/**
 * 앱 루트 (T2.0). GitHub Pages(/edulleo/)에서 새로고침해도 열리도록 HashRouter를 씁니다.
 * TTS 계약 ④: 페이지 숨김·이탈 시 자동 취소(bindAutoCancel)는 여기서 1회만 등록합니다.
 */
export default function App() {
  useEffect(() => getTts().bindAutoCancel(), []);
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
