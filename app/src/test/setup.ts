import '@testing-library/jest-dom/vitest';
import { setLaunchIntroPending } from '../router/launchIntro';

// 앱을 열 때마다 인트로(T6.8)는 기본으로 끔: 화면 테스트들은 '이미 첫 화면 판단이 끝난 페이지'를 가정하고
// 테스트끼리 모듈 상태가 새지 않게 하려는 것. 새 실행 동작은 AppRoutes.test.tsx 전용 테스트(StrictMode 포함)와 E2E S8에서 켜고 검사
beforeEach(() => setLaunchIntroPending(false));
