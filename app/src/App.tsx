import { HashRouter, Route, Routes } from 'react-router-dom';

/** 빈 앱 골격. 라우트 표와 화면은 T2.0에서 채웁니다. */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={<main data-testid="app-root" />} />
      </Routes>
    </HashRouter>
  );
}
