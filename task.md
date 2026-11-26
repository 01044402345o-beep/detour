# Edulleo(에둘러) 데모 — task.md

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.10 (2026-11-26) · 변경 내용은 맨 끝 '변경 이력' 참고 |
| 기준 문서 | `prd.md` v0.14(현재 앱 기준 정리, T6.15) · `DESIGN.md` v1.2 · `PRODUCT.md` · 이전 기준 v0.11(Phase 6 디자인 개편 반영, T6.D)·v0.12(T6.13)·v0.13(T6.14) · 그 이전 기준 v0.6 (v0.3까지 Codex 교차 검증 미해결 0건, v0.4·v0.5 변경분은 `reviews/docs_review_phase1.md`·판정으로 검토, v0.6 변경분(사용자 결정 U-4·U-5)은 `reviews/task_review_v07_verdict.md`·`reviews/task_review_v08.md`·`reviews/task_review_v08_verdict.md`로 검토), `mockup/index.html` |
| 저장소 | https://github.com/01044402345o-beep/edulleo |
| 배포 URL | https://01044402345o-beep.github.io/edulleo/ |

## 0. 이 문서 쓰는 법

- **체크박스가 사용자와 작업자 사이의 의사소통 수단입니다.** task가 끝나면 `- [ ]`를 `- [x]`로 바꾸고 끝에 완료일과 검토 결과 파일을 적습니다.
  예: `- [x] T1.3 주문 문장 생성 모듈 — 2026-11-25 · reviews/T1.3_r2.md (미해결 0)`
- **완료(체크) 조건:** ① 아래 "완료 조건"을 모두 충족하고, ② 9.2절 검토 루프가 미해결 0건으로 끝난 상태. 둘 중 하나라도 아니면 체크하지 않습니다. 완료 조건이 [배포 전]/[배포 후]로 나뉜 task는 [배포 후] 조건까지 충족한 뒤(0.3절 배포 게이트) 체크합니다.
- 진행 중인 task는 제목 끝에 `(진행 중 · 담당 worker)`를 붙이고, 막힌 task는 `(보류: 사유)`를 붙입니다.
- 사용자가 직접 해야 하는 task에는 **[사용자]** 표시가 있습니다.
- task를 체크할 때마다 coordinator가 맨 끝 '진행 현황 요약' 표의 완료 수를 같이 갱신합니다.
- **PRD 우선:** `prd.md`와 목업(`mockup/index.html`)이 충돌하면 PRD를 따릅니다. 목업은 디자인(값·간격·색) 기준입니다. **Phase 6부터 디자인 기준은 `DESIGN.md`와 `mockup/redesign/`**(옛 목업은 이전 화면 동작 참고).

### 0.1 검토 루프 (task마다)
```
Claude worker 작성 → Codex worker 검토(High/Medium/Low) → Claude worker 판정(코드 수정 금지)
→ 타당·부분 타당 항목만 Claude worker 수정 → Codex 재검토 → 미해결 0건이면 체크
```
- 종료 기준·부당 판정 처리·이견 2회 시 사용자 결정은 `prd.md` 9.2절을 따릅니다.
- 검토 기록 파일: `reviews/<TaskID>_r<회차>.md`, 판정 `..._verdict.md`, 수정 내역 `..._fix.md`.
- **task 단위 검증:** 타입 검사(`tsc --noEmit`), 린트, 해당 모듈 단위 테스트(Vitest). E2E는 돌리지 않습니다.
- **phase 단위 검증:** phase의 모든 task가 **배포 전 완료 조건**을 충족하고 검토 미해결 0건이면 Playwright E2E를 한 번 실행합니다. **배포 후 인수 조건**이 있는 task는 smoke 뒤에 체크합니다. 실패하면 원인 task로 돌아가 수정하고 E2E를 다시 실행합니다. 순서는 0.3절 '배포 게이트'를 따릅니다.
  - 기본 뷰포트 390×844. 추가 프로젝트 3개: 360×780, 430×932(시나리오 1·5만 반복), 데스크톱 1280×800(`/report`만).
  - 자동 E2E의 음성은 목(mock) 기반입니다. 실제 음성 경로는 T4.3에서 확인합니다.

### 0.2 동시 진행 규칙
- 같은 phase 안에서 **"병렬 묶음"이 같은 task는 동시에** 진행합니다.
- 동시에 도는 task는 **수정할 파일(소유 파일)이 겹치지 않아야** 합니다. 각 task의 "소유 파일"에 적힌 경로 밖은 읽기만 합니다.
- 공용 파일(`src/types.ts`, `package.json` 등)을 바꿔야 하면 해당 task를 멈추고 coordinator(메인 세션)에 요청합니다.
- **테스트 파일:** 소유 파일과 같은 이름의 `*.test.ts(x)`는 자동으로 그 task가 소유합니다.
- **체크·커밋·push:** task.md 체크, 커밋, push는 coordinator만 합니다.
- **이용 기록:** 각 화면 task는 자기 화면의 `screen_view`·`place_view` 등 이벤트를 store 액션으로 기록합니다. 장소·문장 ID는 코스 데이터(`downtown.json`·`market.json`)의 실제 ID를 그대로 넘기고, `logEvent`의 반환값이 false면 개발 모드에서 경고합니다(T1.6 R2).
- **제보 시트:** `ui/ReportSheet`는 T2.6 소유(T2.0 `ui/` 소유의 예외)이고, T2.3은 import만 합니다.
- **E2E 파일:** Playwright 테스트는 `app/e2e/`에 두고, phase E2E는 coordinator가 작성·실행합니다.

### 0.3 Git·배포 규칙
- 저장소 루트 = 이 폴더(`29_로컬`). `.gitignore`를 **허용 목록 방식**으로 써서 `app/`, `prd.md`, `task.md`, `mockup/`, `reviews/`, `.github/`, `.gitignore`, `README.md`, `DESIGN.md`, `PRODUCT.md`(Phase 6 디자인·제품 기준), `video/`(T2.7 이후, 소스 코드만), `deck/`(T3.3 시연 슬라이드 HTML, QR은 `app/public/qr.svg` 참조)만 올립니다. (HWP·영상·신청서 등 개인 자료는 올리지 않음)
- 허용 목록 아래에 빌드 산출물을 명시 제외합니다: `**/node_modules/`, `**/dist/`, `**/coverage/`, `**/test-results/`, `**/playwright-report/`, `**/.env*`.
- 브랜치: `main`(배포) / `dev`(작업). task는 `dev`에 커밋합니다. 커밋 메시지는 `T1.3: 주문 문장 생성 모듈` 형식.
- 커밋은 coordinator 한 명이 task 소유 파일만 `git add <경로>`로 stage해 수행합니다. task 체크 시 `dev`에 push합니다.
- **배포 게이트 (phase 끝).** 원칙: 배포가 없어도 확인할 수 있는 것은 모두 배포 전 로컬 `vite preview`(base `/edulleo/`)에서 검증합니다. 배포 후 smoke에는 실제 Pages 환경에서만 확인할 수 있는 것만 남깁니다. task 체크는 [배포 전] 조건 기준이고, [배포 후] 조건이 있는 task만 smoke 뒤에 체크합니다.
- **공통 (모든 phase)**
  1. [배포 전] phase의 모든 task가 [배포 전] 완료 조건을 충족하고 검토 미해결 0건입니다. [배포 후] 조건이 없는 task는 이 시점에 체크합니다.
  2. [배포 전] coordinator가 `dev`의 후보 커밋 해시를 고정해 기록합니다.
  3. [배포 전] `npm run build`(base `/edulleo/`) 후 `vite preview`에서 phase E2E를 실행합니다. 실패하면 원인 task로 돌아가 1부터 다시 시작합니다.
  4. [배포] 같은 커밋을 `main`에 병합·push → GitHub Actions가 Pages에 배포합니다.
  5. [배포 후] 배포 URL smoke(모든 phase): HTTPS 200, 콘솔 오류 0건, 자산이 `/edulleo/` 경로로 로드됨.
     smoke 추가(Phase 3 이후): service worker 등록(scope `/edulleo/`), 배포 URL에서 "오프라인 준비 완료" → 오프라인 새로고침.
  6. [배포 후] smoke에 실패하면 `main`을 직전 커밋으로 되돌리고 원인 task로 돌아갑니다.
  7. [배포 후] [배포 후] 인수 조건이 있는 task를 확인하고 체크합니다.
- **Phase 0 (최초 배포)**
  - 0-a. [배포 전] T0.1: `git ls-files` 검사(개인 자료 0건) → 저장소 PUBLIC 전환 → 첫 push → 체크. 이어서 T0.1a로 저장소 Pages 소스를 'GitHub Actions'로 설정합니다(공개 전환 후).
  - 0-b. [배포 전] T0.2 체크(build·test·lint·tsc 통과).
  - 0-c. [배포 전] T0.3 [배포 전] 조건: workflow 파일의 lint·type·test·build 단계가 `dev` push에서 성공.
  - 0-d. 공통 3 대체: build 성공.
  - 0-e. 공통 4~6: 최초 배포 + smoke(200·콘솔 오류 0).
  - 0-f. [배포 후] T0.3 [배포 후] 조건 "배포 URL에서 빈 앱이 열림(HTTPS)" 확인 → T0.3 체크.
- **Phase 1·2:** 공통 1~7을 그대로 따릅니다. Phase 1은 앱 변경이 없으므로 3단계를 "실제 모듈 연결 단위 테스트 + 타입 검사 + build 성공"으로 대신합니다. Phase 1·2 smoke에는 service worker 항목이 없습니다.
- **Phase 2.5 (시연 영상):** 앱 배포 게이트(공통 2~7)를 적용하지 않습니다. T2.7은 `video/`의 타입 검사·린트(설정한 경우) + `npx remotion render` 성공 + `reviews/T2.7_render.md` 기록 + 검토 미해결 0건이면 체크합니다. `video/` 커밋은 `dev`에만 하고 `main` 병합을 일으키지 않습니다.
- **Phase 3 (PWA 후보)**
  - 3-a. [배포 전] T3.1 구현. [배포 전] 완료 조건: preview에서 ① "오프라인 준비 완료" 표시 → 네트워크 차단 → 새로고침 → 미방문 화면 열림, ② 업데이트 토스트 확인(빌드 A preview 접속 → 빌드 B로 다시 build·preview → 새로고침 시 토스트 → 새 버전 적용). 배포가 필요 없으므로 T3.1은 이 시점에 체크합니다.
  - 3-b. [배포 전] T3.3 QR 생성(배포 URL은 고정값)과 슬라이드 삽입. T3.1과 병렬. [배포 후] 조건(스캔)이 남으므로 아직 체크하지 않습니다.
  - 3-c. [배포 전] 빌드 고정 → T3.2 측정(preview에서 Fast 4G·캐시 없음 측정, 번들 리포트) → T3.2 체크.
  - 3-d. 공통 3: preview에서 Phase 2 시나리오 + 오프라인 시나리오 실행.
  - 3-e. 공통 4~6 (smoke에 Phase 3 이후 항목 포함).
  - 3-f. [배포 후] T3.3 [배포 후] 조건: 슬라이드 화면의 QR을 실제 휴대폰으로 스캔 → 앱 열림 → T3.3 체크.
- **Phase 4는 4A/4B로 나눕니다(사용자 결정 2026-11-23: 현장 확인 T4.1은 나중에). 둘 다 0.1절 'phase 단위 검증'보다 우선합니다.**
- **Phase 4A (지금, 현장 확인 불필요)**
  - 4A-a. [배포 후] 대상은 Phase 3 배포본(예시 정보 + "현장 확인 전 · 예시 정보" 표시)입니다. 그 배포 커밋 해시를 **4A 기준 커밋**으로 기록합니다. 4A 시작에 새 배포는 없습니다.
  - 4A-b. [배포 후] T4.3: 4A 기준 커밋 대상 실기기 점검 → 체크.
  - 4A-c. [배포 후] T4.5: 같은 4A 기준 커밋 대상 리허설(예시 정보 상태, 비상 시나리오 포함) → 체크. 리허설에서 앱 수정이 생기면 원인 task 수정·검토 루프 → 공통 2~6 → 그 배포 커밋을 새 4A 기준 커밋으로 기록하고 T4.3(변경 영향 범위)·T4.5를 다시 합니다.
  - 4A-d. (T4.2 결과 또는 T4.4c 연락처가 4A 중에 도착한 경우) [배포 전] T4.2a 반영과 검토 루프 → 미해결 0건이면 체크 → 공통 2~6(preview에서 Phase 2·3 시나리오 재실행 → 배포 → smoke) → 그 배포 커밋을 새 4A 기준 커밋으로 기록하고 T4.3(변경 영향 범위)·T4.5를 그 커밋 기준으로 다시 확인합니다. 4A 중에 오지 않으면 4B의 T4.1a에서 반영합니다.
  - **4A 완료 = 확인 전 표시 상태로 심사 시연 가능(PRD 4장 v0.6 예외, 사용자 결정 U-4):** 최종 4A 기준 커밋에서 T4.3·T4.5가 체크되고, 정정·삭제 연락처가 표시된 상태. 현장 정보 검증 완료를 뜻하지 않습니다.
- **Phase 4B (현장 확인 후)**
  - 4B-a. [배포 전] T4.1 결과 수령(T4.4, 4A에서 반영하지 않은 T4.2 결과 포함) → 사용자 task 체크.
  - 4B-b. [배포 전] T4.1a 반영과 검토 루프(확인된 장소 `verified:true`·`checkedAt` → 배지 자동 전환). 미해결 0건이면 체크.
  - 4B-b2. [배포 전] coordinator: E2E 기대값 갱신(0.2절 E2E 소유). 장소 확인 배지는 고정 문자열 대신 `downtown.json`·`market.json`의 장소별 `verified`·`checkedAt`에서 기대값을 만들도록 바꾸고(확인한 장소 = "확인일 YYYY-MM-DD", 미확인 장소 = "현장 확인 전 · 예시 정보" 유지 확인), T4.1a·T4.2a로 바뀐 메뉴·가격·문구 고정값도 같이 점검. 데이터를 테스트에 맞춰 되돌리지 않습니다. 대상: `p3-offline.spec.ts`, `s6-report-count.spec.ts` 외 확인 배지·메뉴 문자열을 고정한 spec 전부(grep `place.unverified`, 메뉴 testid). 데이터 기반 기대값 변경은 4A 중에 미리 해 두어도 되며(현재 데이터에서는 결과가 같음), 미리 했다면 4B-b2는 고정값 점검만 합니다.
  - 4B-c. 4B-b2 갱신 후 공통 2~6 (Phase 4B E2E = preview에서 Phase 2·3 시나리오 재실행 → 배포 → smoke, Phase 3 이후 항목 포함). 이 배포 커밋 해시를 **4B 기준 커밋**으로 기록합니다.
  - 4B-d. T4.7: 4B 기준 커밋에서 T2.7 영향 장면 재녹화·재렌더(0.3절 Phase 2.5 규칙, 앱 배포 게이트 없음) → 체크.
  - 4B-e. [배포 후] T4.3b: 4B 기준 커밋 대상 짧은 재점검(변경 영향 범위) → 체크.
  - 4B-f. [배포 후] T4.5b: 같은 4B 기준 커밋 대상 짧은 리허설 → 체크. 리허설에서 수정이 생기면 4B-b로 돌아갑니다.
- **확인 기준:** 어떤 [배포 전] 단계도 아직 수행하지 않은 배포의 결과를 요구하지 않습니다(0-c·3-a·3-b·4A-d·4B-b·4B-b2는 로컬·CI 결과만 요구).

---

## Phase 0 — 기반 준비 (순차)

- [x] **T0.1 저장소 초기화** — 소유: `.gitignore`, `README.md`, `.github/` — 2026-11-23 · reviews/T0.1_r2.md (미해결 0) · PUBLIC 전환·push 완료
  - git init, 허용 목록 `.gitignore`(0.3절 제외 목록 포함), 원격 `origin` 연결, `main`/`dev` 브랜치 생성
  - 현재 저장소 `01044402345o-beep/edulleo`는 PRIVATE·빈 저장소. 무료 GitHub Pages를 쓰기 위해 **첫 push 직전**에 coordinator가 `gh repo edit 01044402345o-beep/edulleo --visibility public --accept-visibility-change-consequences`로 PUBLIC 전환
  - 공개 전환의 선행 조건: `git ls-files` 목록 검사에서 허용 경로만 있고 개인 자료(HWP, mp4, 신청서 PDF 등) 0건
  - README: 프로젝트 한 줄 소개, 실행 방법, 문서 링크(prd/task/mockup)
  - 완료 조건: 첫 커밋 전 `git ls-files` 전체 목록을 `reviews/T0.1_files.txt`에 남기고, 허용 경로만 있음(개인 자료 0건). 그 뒤 저장소 PUBLIC 전환 확인(`gh repo view --json visibility`가 `PUBLIC`). 원격 push 성공.
- [x] **T0.1a GitHub Pages 활성화** — 담당: coordinator (실패 시에만 **[사용자]**). T0.1의 공개 전환 후 수행 — 2026-11-23 · build_type=workflow 확인
  - coordinator가 `gh api -X POST repos/01044402345o-beep/edulleo/pages -f build_type=workflow`로 Pages 소스를 'GitHub Actions'로 설정합니다
  - `gh`로 안 되면 이 task를 **[사용자]**로 바꾸고, 사용자가 저장소 Settings → Pages → Source를 'GitHub Actions'로 설정합니다
  - 완료 조건: `gh api repos/01044402345o-beep/edulleo/pages`의 `build_type`이 `workflow`
- [x] **T0.2 앱 골격** — 소유: `app/` 전체 (이 시점에만) — 2026-11-23 · reviews/T0.2_r2.md (미해결 0)
  - `app/`에 Vite + React + TypeScript 생성. 의존성: react-router-dom, zustand, leaflet, vite-plugin-pwa, vitest, @testing-library/react, @playwright/test, eslint, prettier
  - 스타일: **CSS Modules + 전역 토큰 `app/src/styles/tokens.css`** (목업의 색·글꼴·반경 값을 그대로 옮김). Tailwind는 쓰지 않음
  - `vite.config.ts`의 `base: '/edulleo/'`, HashRouter
  - 폴더 구조 확정:
    ```
    app/src/
      data/        콘텐츠 JSON + 검증
      i18n/        en.json ja.json zh.json + t()
      domain/      orderSentence.ts scoring.ts numerals.ts events.ts
      speech/      tts.ts stt.ts
      store/       useAppStore.ts
      ui/          공용 컴포넌트(Button, Pill, Card, TopBar, TabBar, Sheet, Toast)
      screens/     S00~S13 화면
      styles/      tokens.css global.css
      types.ts
    app/e2e/       Playwright (coordinator)
    ```
  - `app/src/types.ts`에 PRD 8.1 데이터 모델을 TypeScript 타입으로 작성 (`priceKrw?`, `allergenStatus` 포함)
  - **공유 계약:** `types.ts`에 `OrderSentence`(`words[]` 구체 타입 포함)·`ScoreResult`·`SttState`·`TtsState` 타입, `numerals.ts` 함수 시그니처(`toNative(n)`, `toSino(n)`), store의 `lang` 슬라이스 골격
  - 완료 조건: `npm run dev`로 빈 화면 표시, `npm run build`·`npm run test`·`npm run lint`·`tsc --noEmit` 모두 통과, 공유 계약 파일 존재
- [x] **T0.3 CI·배포 골격** — 소유: `.github/workflows/` — 2026-11-23 · reviews/T0.3_r2.md (미해결 0) · 배포 252d106→favicon 수정 후 smoke 200·콘솔 오류 0
  - PR/push 시 lint·type·unit test 실행, `main` push 시 build → GitHub Pages 배포
  - 완료 조건 [배포 전]: workflow 파일의 lint·type·test·build 단계가 `dev` push에서 성공
  - 완료 조건 [배포 후]: `main`에 빈 앱이 배포되어 배포 URL에서 열림 (HTTPS) → smoke 뒤 체크 (0.3절 0-f)

**Phase 0 E2E:** 0.3절 배포 게이트 Phase 0(0-a~0-f)을 따릅니다. 공통 3은 'build 성공'으로 대신하고, smoke는 배포 URL 200 응답·콘솔 오류 0건입니다.

---

## Phase 1 — 데이터·도메인 로직 (병렬 묶음 A: 6개 동시)

> 화면 없이 순수 로직과 데이터만 만듭니다. 모두 단위 테스트로 검증합니다. 서로의 모듈은 T0.2 공유 계약(타입·시그니처)만 의존하고, 구현이 필요하면 fixture로 테스트합니다.

- [x] **T1.1 원도심 콘텐츠 데이터** — 소유: `app/src/data/` — 2026-11-23 · reviews/T1.1_r2.md (미해결 0)
  - `downtown.json`: 코스 1개, 장소 4곳(PRD 4장), 메뉴 8개, 문장 14개, 단계 안내, 좌표, 확인일
  - 현장 미확인 값은 `verified:false`, 가격 미확인은 `priceKrw` 생략, 알레르기 미확인은 `allergenStatus:'unknown'`
  - 광천식당 주소(선화동)·사리 명칭은 데이터 안 `note` 필드에 "확인 필요" 표기
  - 장소별 문장의 `words`(단어 칩)와 3개 언어 뜻, 로마자·가타카나
  - `validate.ts`: 타입·필수 필드·L10n 3개 언어 누락·좌표 범위 검사
  - 완료 조건: 검증 테스트 통과(누락 0), 목업 데이터와 내용 일치
- [x] **T1.1b 장소 확인 상태 필드** — 소유: `app/src/data/`, `app/src/types.ts`(Place) — 2026-11-23 · reviews/T1.1b_r1.md (미해결 0)
  - `Place.verified: boolean` 추가(장소의 영업시간·주소·주문 방식 현장 확인 여부. 메뉴의 `verified`와 별개), `downtown.json` 4곳 모두 `false`, `validate.ts` 필수 검사·테스트
  - `i18n` 3개 사전에 확인 전 표시 키 1개 추가(한국어 원문 "현장 확인 전 · 예시 정보", 번역은 T4.2 검수) — T1.2 소유 파일이므로 같은 커밋에서 coordinator 승인으로 수정
  - 완료 조건: 데이터·i18n 테스트, 타입 검사 통과 (docs_review_phase1 판정 DOC-M-02)
- [x] **T1.2 다국어 사전** — 소유: `app/src/i18n/` — 2026-11-23 · reviews/T1.2_r3.md (미해결 0)
  - `en.json`·`ja.json`·`zh.json`: 목업의 UI 문구 전체 + PRD에 정한 고지 문구(비제휴 안내, 음성 처리 안내, 가격 확인 필요, 총액 확인 필요, 인식 실패 메시지 등)
  - **PRD 우선:** PRD와 목업이 충돌하면 PRD를 따릅니다. 목업 `privacy` 키는 '이용 기록은 이 기기에만 저장됩니다(음성은 저장하지 않음)' 취지로 교체합니다(PRD F-08·7장)
  - `t(lang, key)`는 순수 함수, `useT()`는 store의 `lang` 계약만 import. 키 누락 시 개발 모드 경고
  - 하드코딩 검사 예외 목록: 한국어 콘텐츠 JSON(학습 문장·메뉴명), 직원 화면 고정 문구(한국어 안내·응답 버튼), 운영자 리포트 문구(S13, `operatorKo.ts` — T1.2 R1), 상호명
  - T1.1b 확인 전 표시 키 1개 추가(예: `place.unverified`, 한국어 원문 "현장 확인 전 · 예시 정보", en·ja·zh 번역은 T4.2 검수 대상) — T1.1b가 coordinator 승인으로 같은 커밋에서 수정 (docs_review_phase1 판정 DOC-M-02)
  - 완료 조건: 세 파일의 키 집합이 같음(테스트), 빈 문자열·영어 fallback 없음(ja·zh), 예외 목록 밖 하드코딩 문구 없음(린트 규칙 또는 검사 스크립트)
- [x] **T1.3 주문 문장 생성 + 수사 검수표** — 소유: `app/src/domain/orderSentence.ts`, `numerals.ts` — 2026-11-23 · reviews/T1.3_r2.md (미해결 0)
  - PRD F-06 규칙: `{메뉴} {수사} {단위}, … 주세요.` + 포장 시 ` 포장해 주세요.`, 수량 1~9, 0개 제외, 빈 주문이면 `null`
  - 단위별 수사: `개`·`공기` → 고유어(한·두·세·네·다섯·여섯·일곱·여덟·아홉), `인분` → 아라비아 숫자 + 인분(읽기: 일·이·삼·사·오·육·칠·팔·구)
  - 출력: T0.2의 `OrderSentence` 타입 (`{ ko, roman, kana, meaning: L10n, words[] }`)
  - **수사 검수표** (테스트 기대값으로 사용). 표기 정책: 로마자·가타카나는 완성 구절의 발음(연음 반영) 기준. 된소리(예: 다섯 개 [다섣깨])는 로마자 규정대로 표기하지 않음.

    | n | 개 (ko / roman / kana) | 공기 (ko / roman / kana) | 인분 (ko / roman / kana) |
    |---|---|---|---|
    | 1 | 한 개 / han gae / ハン ゲ | 한 공기 / han gonggi / ハン コンギ | 1인분 / irinbun / イリンブン |
    | 2 | 두 개 / du gae / トゥ ゲ | 두 공기 / du gonggi / トゥ コンギ | 2인분 / i-inbun / イインブン |
    | 3 | 세 개 / se gae / セ ゲ | 세 공기 / se gonggi / セ コンギ | 3인분 / saminbun / サミンブン |
    | 4 | 네 개 / ne gae / ネ ゲ | 네 공기 / ne gonggi / ネ コンギ | 4인분 / sa-inbun / サインブン |
    | 5 | 다섯 개 / daseot gae / タソッ ゲ | 다섯 공기 / daseot gonggi / タソッ コンギ | 5인분 / o-inbun / オインブン |
    | 6 | 여섯 개 / yeoseot gae / ヨソッ ゲ | 여섯 공기 / yeoseot gonggi / ヨソッ コンギ | 6인분 / yuginbun / ユギンブン |
    | 7 | 일곱 개 / ilgop gae / イルゴプ ゲ | 일곱 공기 / ilgop gonggi / イルゴプ コンギ | 7인분 / chirinbun / チリンブン |
    | 8 | 여덟 개 / yeodeol gae / ヨドル ゲ | 여덟 공기 / yeodeol gonggi / ヨドル コンギ | 8인분 / parinbun / パリンブン |
    | 9 | 아홉 개 / ahop gae / アホプ ゲ | 아홉 공기 / ahop gonggi / アホプ コンギ | 9인분 / gu-inbun / クインブン |

    표의 가타카나는 근사 표기이며 원어민 검수(T4.2) 대상.
  - 완료 조건: 검수표 27칸 + 포장/매장 + 여러 품목 + 빈 주문 테스트 통과
- [x] **T1.4 채점 모듈** — 소유: `app/src/domain/scoring.ts` — 2026-11-23 · reviews/T1.4_r2.md (미해결 0)
  - 정규화: 공백·문장부호 제거, 숫자 → 한글 수사(뒤따르는 단위 기준: 개·공기·명 → 고유어, 인분 → 한자어. `numerals.ts` 시그니처만 의존하고 fixture로 테스트), 소문자화
  - 한글 음절 → 자모 분해, 레벤슈타인 거리 → "인식 일치도" 점수 = `round(100 × (1 − 거리 / max(목표 자모 수, 인식 자모 수)))`, 하한 0
  - 단어별 일치 여부(목표 단어 기준 정렬), 가장 약한 단어 1개 반환. 출력은 T0.2의 `ScoreResult` 타입
  - 빈 인식 결과 → `{ status:'empty' }` (0점 아님)
  - 완료 조건: 기대값 예시(완전 일치 → 100, '두 개'↔'2개' → 100, 빈 결과 → `empty`) 포함, 한 글자 틀림·띄어쓰기 차이·숫자 표기 차이·빈 입력 테스트 통과
- [x] **T1.5 음성 어댑터** — 소유: `app/src/speech/` — 2026-11-23 · reviews/T1.5_r3.md (미해결 0)
  - `tts.ts`: `speak(text, rate)`, 한국어 음성 찾기(`voiceschanged` 대기, 최대 2초), 사용자 탭에서만 시작, 화면 이탈 시 `cancel()`, 상태 `unsupported | no-korean-voice | ready`
  - `stt.ts` 상태 머신 (PRD F-08):
    ```
    idle → requesting(권한) → listening → processing → result
                    ↘ denied      ↘ no-speech / timeout(8초) / network / aborted / error
    unsupported (API 없음)
    ```
    모든 실패 상태는 `{ retry, showStaff }` 두 선택지를 UI에 넘김(단, `unsupported`는 재시도가 의미 없으므로 `showStaff`만 — T0.2 R1 판정). 권한 대기(requesting)는 15초 기한 후 실패 처리(T1.5 R1 판정). 인식 원문은 결과로만 반환하고 저장·로그하지 않음
  - 테스트: Web Speech API 목(mock)으로 상태 전이 전부 검증
  - 완료 조건: 상태 전이 테스트 통과, 타임아웃 8초 테스트(가짜 타이머)
- [x] **T1.6 앱 상태·이용 기록** — 소유: `app/src/store/`, `app/src/domain/events.ts` — 2026-11-23 · reviews/T1.6_r3.md (미해결 0)
  - Zustand + persist(localStorage, 실패 시 메모리로 대체): `lang`(T0.2 골격 확장), `cart{placeId: {menuId: n}}`, `takeout`, `saved`, `reports`, `events`
  - 장소가 바뀔 때 기존 주문이 있으면 비울지 확인하는 액션(`switchPlace` → `needsConfirm`)
  - `switchPlace`와 문장 생성 시 `takeout:false` 장소면 `takeout=false`로 강제 (PRD F-05 '매장으로 고정')
  - 이벤트 종류: `screen_view`, `place_view`, `phrase_play`, `practice_done`, `staff_shown`, `report_sent` (개인정보·인식 원문 없음, 최대 500건, 초기화 가능)
  - 지표 정의 (F-15): **추가 방문 비율** = 성심당 `place_view` 이후 같은 세션에서 다른 정류장 `place_view`가 있는 세션 수 ÷ 성심당 `place_view`가 있는 세션 수. 세션 = 앱 열고 30분 무활동 전까지
  - 완료 조건: 리듀서·지표 계산·persist 실패 대체·`takeout` 강제 테스트 통과

**Phase 1 E2E:** 해당 없음(화면 없음). 대신 모듈 간 실제 import 연결 상태(fixture 대신 실제 모듈)에서 Phase 1 전체 단위 테스트 + 타입 검사 + build 성공을 확인합니다(0.3절 공통 3 대체).

---

## Phase 2 — 화면 구현

> 목업(`mockup/index.html`)이 디자인 기준입니다. 값·간격·색은 목업과 맞춥니다. 목업과 PRD가 충돌하면 PRD를 따릅니다.
> T2.1~T2.6 공통 완료 조건: 명시된 동작 각각의 컴포넌트 테스트 통과 + 목업과 시각 대조 캡처 `reviews/T2.x_screens.png`. 각 화면은 자기 화면의 이용 기록 이벤트를 store 액션으로 남깁니다.

### 2-1 공용 UI (순차, 먼저)
- [x] **T2.0 공용 컴포넌트·레이아웃** — 소유: `app/src/ui/`(`ui/ReportSheet`, `ui/map/` 제외), `app/src/styles/`, `app/src/App.tsx`, 라우터, `screens/*/index.tsx` placeholder(최초 생성만) — 2026-11-23 · reviews/T2.0_r3.md (미해결 0) · 커밋은 화면 placeholder가 T2.1~T2.6과 얽혀 Phase 2 통합 커밋에 포함
  - T2.0 체크 시점에 각 placeholder의 소유는 해당 화면 task로 넘어갑니다
  - Button, Pill, Card, IconButton, TopBar, TabBar, Sheet(바텀시트), Toast, 아이콘 세트(SVG)
  - `ui/ListenButton`: 공용 듣기 버튼. TTS `no-korean-voice`·`unsupported` 안내 UI 담당 (F-07). TTS 사용 계약(T1.5 R2·R3 판정): ① 마운트 시 `tts.init()`을 호출하고, 완료되면 `getState()`로 안내를 갱신(언마운트 뒤 도착한 결과는 무시) ② 탭 핸들러에서는 `init()`을 기다리지 않고 `speak()`를 동기로 호출 ③ `onEnd`는 선점·취소된 요청에도 1회 오므로 자기 요청의 재생 표시만 끔 ④ 화면 이탈 시 effect cleanup에서 `cancel()`, `bindAutoCancel()`은 앱 루트(`App.tsx`)에서 1회 등록
  - `ui/Pronunciation`: 발음 표기 공용 표시. EN·ZH는 로마자, JA는 가타카나 (F-01)
  - 라우트 표: `/lang` `/` `/course` `/place/:id` `/order` `/practice` `/result` `/staff` `/reply` `/phrases` `/saved` `/settings` `/report`. 각 라우트는 `screens/<이름>/index.tsx`를 lazy import(빈 화면 placeholder). 라우트 → `ScreenKey`(events.ts의 `SCREEN_KEYS`, S00~S13) 매핑 표를 라우터에 두고 `screen_view`는 이 키로 기록(라우트 경로를 그대로 넘기면 기록이 버려짐 — T1.6 R2)
  - 연습·직원 화면 입력 상태 계약: `{ src: 'order'|'phrase', phraseId? }`
  - 첫 실행(언어 미선택) → `/lang` 리다이렉트
  - 데스크톱에서 폰 폭(430px) 가운데 정렬, `/report`만 예외
  - 완료 조건: 모든 라우트가 빈 화면으로 열림, 터치 영역 44px 이상, 대비 4.5:1 검사 통과

### 2-2 화면 (병렬 묶음 B: 6개 동시, T2.0 완료 후)
- [x] **T2.1 언어 선택·홈·설정 (S00·S01·S12)** — 소유: `screens/Lang*`, `screens/Home*`, `screens/Settings*` — 2026-11-23 · reviews/T2.1_r2.md (미해결 0) · 토스트 폭은 T2.0 R4에서 해소 · 커밋은 Phase 2 통합 커밋
  - 언어 즉시 전환, 잠긴 거점·1박 배너는 "Coming soon" 토스트, 오늘의 코스(F-02), 오늘의 문장 듣기, 설정 → 운영자 리포트 진입, 데모 데이터 초기화
  - 설정 하단에 정정·삭제 연락처 표시 자리(PRD 10장). 값은 T4.4c에서 확정해 T4.2a(4A)에서 반영(4A에서 못 하면 T4.1a)
- [x] **T2.2 코스 지도 (S02)** — 소유: `screens/Course*`, `ui/map/` — 2026-11-23 · reviews/T2.2_r3.md (미해결 0) · 네이버 URL은 T4.3 이관 · 커밋은 Phase 2 통합 커밋
  - Leaflet + OSM 타일, OSM 출처 표시 상시 노출, 번호 핀 4개 + 정류장 연결선(보행 경로 아님 표기)
  - 타일 로드 실패·오프라인 → SVG 약도로 자동 전환
  - 정류장 목록에 이동 시간·확인 상태 표시: 장소 `verified:true`면 "확인일 YYYY-MM-DD", `false`면 날짜 없이 "현장 확인 전 · 예시 정보"(T1.1b). 핀·목록 클릭 → 장소 상세 (F-03)
  - "Start walking" → 다음 정류장의 **네이버 지도 웹 길찾기 URL**(기본) 열기. Google Maps는 장소 보기용 보조 링크
- [ ] **T2.2b 도보 경로선·네이버 앱 안내 (사용자 요청 2026-11-24, 4A 기준 커밋 이후 변경)** — (현재 상태 2026-11-26, T6.15: 구현 커밋 19e9d8d·51a42c3, 검토는 T5.1 R1~R5에 포함되어 미해결 0. 체크는 사용자 확인 후) — 소유: `ui/map/`, `screens/Course*`, `screens/Place/InfoTabs.tsx`, `data/route.ts`·`data/downtown.route.json`, `scripts/gen-course-route.mjs`
  - 경로는 개발 시 `node scripts/gen-course-route.mjs downtown`(T5.1부터 코스 이름 인자 필수)으로 한 번 계산(OSM 기반 OSRM 도보, routing.openstreetmap.de)해 커밋. 앱 실행 중 경로 API 호출 없음 → 오프라인·외부 호출 없음 유지
  - `downtown.route.json`(T5.1 전 이름 `courseRoute.json`): 출발지 + 정류장 순서의 구간(점 수 − 1개, 현재 대전역 + 4곳 = 4구간)별 [위도, 경도] 목록, 양 끝 = 해당 지점(출발지·정류장) 좌표, 출처·계산일·`verified:false`. 로드 시 검증(순서·구간 수·양 끝 좌표), 정류장 좌표만 바꾸고 재계산하지 않으면 throw
  - 타일 지도: 실선 경로(점선 직선 대체). 약도: 같은 경로를 정류장과 같은 축척으로 투영. 안내 문구 `course.routeNote`(참고용 · 정확한 길 안내는 NAVER Map)
  - 네이버 앱 안내: 코스 버튼 아래 "…in the NAVER Map app" + `course.noApp`(앱이 없으면 번호 지도·도보 시간), 장소 상세 `place.dirHint`
  - 현장 확인(T4.1) 때 경로를 실제로 걸어 보고 다르면 좌표 보정 후 재계산. 정류장 `walkMinFromPrev`(예시값 2·12·10분)와 계산 거리(269·552·596m) 차이 확인
  - 출발지 = 대전역 서광장(2026-11-24 사용자 결정, 도보 기본 + 1호선 1정거장 대안 문구). `course.start`(예시 좌표, 현장 확인 필요), 대전역→성심당 812m → 1번 도보 11분, 총거리 2.2km. 지도: 번호 없는 이름표(누를 수 없음), 전체가 한 화면에 들어가도록 맞춤. 약도의 장식 하천·"대전역 방향 →"은 출발지가 있을 때 숨김(장식 하천 위치가 실제와 반대)
  - 후속: T4.3 ⑦a·⑦b 재점검, T4.2 번역 시트에 새 문구(noApp·dirHint·routeNote·walkFromStart, from·mapStation 변경) 추가, T4.5 영상 장면 비교
- [x] **T2.3 장소 상세·메뉴 담기·내 주문 (S03·S04·S05)** — 소유: `screens/Place*`, `screens/Order*` — 2026-11-23 · reviews/T2.3_r2.md (미해결 0) · 커밋은 Phase 2 통합 커밋
  - 탭(메뉴/이용 방법/문장), `orderable:false`면 메뉴 탭 없이 이용 방법 탭으로 열림, 확인일 배지(장소 `verified:false`면 "확인일" 대신 "현장 확인 전 · 예시 정보". 메뉴가 없는 장소도 같음. 메뉴의 `verified`는 메뉴·가격에만 해당하며 장소 확인 여부로 쓰지 않음 — T1.1 R1, T1.1b), 영업 상태(Asia/Seoul 기준 참고값), 알레르기(미확인은 "확인 필요"), 비제휴 안내 문구
  - 길찾기 버튼: 네이버 지도 웹 길찾기(기본), Google Maps 장소 보기(보조) (F-04)
  - 장소 북마크 추가·해제, 새로고침 후 유지 (F-13)
  - "정보가 달라요" → `ui/ReportSheet`(T2.6) import
  - +/− 수량(1~9), 1에서 −를 누르면 항목 삭제, 주문 바(수량, 모든 가격 확인 시 합계 예시가), 가격 미확인 → "가격 확인 필요"·"총액 확인 필요" (F-05)
  - 다른 장소에서 담으려 하면 기존 주문 비울지 확인 시트
  - 내 주문: 주문 카드(문장·발음·번역), 포장/매장(`takeout:false`면 숨기고 매장 고정, 표시·문장 생성에는 store의 `effectiveTakeout` 헬퍼 사용 — T1.6 R1), 빈 주문이면 버튼 비활성
- [x] **T2.4 말하기 연습·채점 결과 (S06·S07)** — 소유: `screens/Practice*`, `screens/Result*` — 2026-11-23 · reviews/T2.4_r2.md (미해결 0) · 단어 칩 한국어 낭독은 T4.3 이관 · 커밋은 Phase 2 통합 커밋
  - 마이크 켜기 전 음성 처리 안내(3개 언어), STT 상태 머신 UI 연결, 실패 시 재시도/직원에게 보여주기. 권한 대기(requesting) 중에도 취소 버튼과 "직원에게 보여주기"를 노출(기한: requesting 15초, listening·processing 각 8초 — T1.5 R1). 문장·단어 칩 듣기는 `ui/ListenButton`을 사용(TTS 계약은 T2.0 참조 — T1.5 R3)
  - 단어 칩 TTS, 0.75배속, 진행률, 결과 화면 "인식 일치도" 점수·약한 단어·팁
  - 단어별 일치 여부를 색으로 표시, 팁은 사용자 언어 (F-09)
- [x] **T2.5 직원에게 보여주기·직원 응답 (S08·S09)** — 소유: `screens/Staff*`, `screens/Reply*` — 2026-11-23 · reviews/T2.5_r1.md (지적 0) · 커밋은 Phase 2 통합 커밋
  - 전체 화면 표시, 한국어 고정 안내(주문/요청 구분), 주문 항목 목록(`src:'phrase'`면 목록 숨기고 안내는 "외국인 손님의 요청입니다") (F-10)
  - 큰 글씨 토글, 읽어주기, 응답 4종 → 손님 언어로 크게 표시, 품절 → 주문 수정
  - 화면 켜짐 유지(Wake Lock API, 미지원 시 무시)
- [x] **T2.6 문장 모음·저장·제보·운영자 리포트 (S10·S11·S13)** — 소유: `screens/Phrases*`, `screens/Saved*`, `screens/Report*`, `ui/ReportSheet` — 2026-11-23 · reviews/T2.6_r2.md (미해결 0) · 커밋은 Phase 2 통합 커밋
  - 문장 모음(듣기·연습), 문장 북마크 추가·해제(새로고침 후 유지), 저장 목록, 제보 시트(4종) → 이벤트 기록
  - 운영자 리포트(한국어 고정, 문구는 `i18n/operatorKo.ts` — T1.2 R1): 지표 4종(추가 방문 비율·성심당 다음 방문지 분포·많이 쓴 문장·제보 현황), 예시 데이터 + "예시 데이터" 표기, 내 기기 기록은 따로 표시하고 합산하지 않음(F-16a), 휴대폰에서는 1열. 내 기기 지표의 기준 장소(성심당 id `ssd`)를 `extraVisitRate`·`nextPlaceDistribution`에 넘기고, 이벤트 기반 지표(추가 방문 비율·다음 방문지·많이 쓴 문장·이용 기록 수)는 "최근 500건 기준"으로 표기. 내 기기 제보 건수는 `reports.length` 기준(이벤트 500건 상한과 무관, `report_sent` 이벤트 수로 세지 않음) — T1.6 R1

**Phase 2 E2E (Playwright, 0.1절 뷰포트, 3개 언어 각각, `vite preview` 대상):**
1. 언어 선택 → 홈 → 원도심 → 성심당 → 튀김소보로 2·판타롱부추빵 1 담기 → 내 주문 문장이 검수표 기대값과 일치
2. 연습 → (STT 목) 성공 → 결과 화면 점수 표시 → 직원에게 보여주기 → "품절이에요" → 손님 언어 표시 → 주문 수정
3. (STT 목) 미지원/권한 거부/무음/타임아웃 → 직원에게 보여주기 → 응답 "네" → 손님 언어 표시까지 완주
4. 광천식당: 포장 토글 숨김, 오징어두루치기(가격 미확인) 담기 → "총액 확인 필요"
5. 설정 → 언어 변경 → UI 문구 전환 + 한국어 고정 영역 유지(하드코딩 검사 예외 목록 기준) → 운영자 리포트 진입(리포트는 언어 설정과 무관하게 한국어 유지)
6. 제보 → 리포트의 내 기기 제보 건수 +1
7. 성심당 포장 선택 → 광천식당으로 전환 → 문장에 "포장해 주세요" 없음

---

## Phase 2.5 — 시연 영상 (Remotion · 사용자 요청 2026-11-23)

> Phase 2 E2E 통과 후 시작합니다. 앱 코드(`app/`)를 바꾸지 않고 앱 배포와 무관하므로(0.3절 Phase 2.5) **Phase 3과 병렬로 진행**합니다. Phase 4B에서 콘텐츠가 바뀌면 T4.1a로 바뀐 화면이 나오는 장면을 Phase 4B 배포 커밋에서 **다시 녹화**한 뒤 렌더링합니다(T2.7 재실행 = T4.7).

- [x] **T2.7 Remotion 시연 영상** — 소유: `video/` 전체(렌더 결과 `video/out/`은 git 제외) — 2026-11-23 · reviews/T2.7_r2.md (미해결 0) · 렌더 video/out/detour-demo-ko·en.mp4 88.8초 · 남은 [사용자] 항목: edge-tts 이용 조건 확인, 음성 청취
  - 준비: Remotion 에이전트 스킬 설치, `video/`에 Remotion 프로젝트 생성. Remotion 라이선스 조건(개인·소규모 무료 여부)을 확인해 `reviews/T2.7_license.md`에 기록
  - 장면 구성(약 90초, 폰 프레임 390×844 + 자막): 문제 제기(빵집 한 곳 집중) → 언어 선택 → 원도심 코스 → 성심당 메뉴 담기 → 한국어 주문 카드 → 듣고 따라 말하기·인식 일치도 → 직원에게 보여주기·직원 응답 → 광천식당(매장 식사) → 운영자 리포트("빵집 다음은 어디였나") → 마무리(QR·배포 URL)
  - 앱 화면은 **Phase 2 배포 커밋의 `vite preview`에서 Playwright로 자동 녹화**한 클립을 사용합니다. 컴포넌트 import는 쓰지 않습니다(**사용자 결정 U-1**). 앱 쪽 수정이 필요하면 coordinator에 요청합니다
  - 음성 인식 장면은 재현 장면임을 화면에 작게 표시합니다(실제 인식 화면은 T4.3 기기 녹화로 교체 가능)
  - 자막 언어: 한국어 기본 + 영어 버전(일본어·중국어는 선택)
  - 내레이션: 기존 홍보영상(`daejeon-detour-film/`)과 같은 방식으로 새로 만듭니다(**사용자 결정 U-3**): 영어는 Kokoro 오프라인 TTS, 한국어는 edge-tts 온라인 음성. 기존 파일은 수정하지 않고, 기존 홍보영상의 영상·이미지 소재는 재사용하지 않습니다(음성 제작 방식만 참고)
    - [ ] **[사용자]** edge-tts 이용 조건(시연·공개 영상에 써도 되는지) 확인
  - 완료 조건: `npx remotion render`로 1080×1920(세로) mp4 생성, 길이 120초 이하, 자막·화면 문구가 PRD(비제휴 안내, 인식 일치도 용어, 예시 데이터 표기, 가게 로고·간판·실사 사진 미사용(일러스트만))와 일치, 렌더 결과 경로와 길이 + 녹화에 쓴 앱 커밋 해시와 장면별 클립 목록을 `reviews/T2.7_render.md`에 기록, 검토 미해결 0건
  - Git (coordinator): 공개 범위는 **사용자 결정 U-2**에 따라 소스 코드(Remotion 코드·자막)만 올립니다. `.gitignore` 허용 목록에 `video/`를 추가하고 `video/out/`, `video/node_modules/`, `video/public/clips/`(녹화 클립), `video/public/vo/`(내레이션 음성)를 제외합니다. 완성 mp4도 올리지 않습니다

---

## Phase 3 — 오프라인·성능·배포 (순차: T3.1 → 빌드 고정 → T3.2, T3.3은 병렬. 순서는 0.3절 3-a~3-f)

- [x] **T3.1 PWA·오프라인** — 소유: `app/public/manifest.webmanifest`, `app/src/sw/`, `vite.config.ts`, `screens/Settings*`의 오프라인 표시 부분, `ui/Toast` 연결, `package.json`·lock(플러그인 추가 시) — 2026-11-23 · reviews/T3.1_r4.md (미해결 0) · 오프라인 검증 PASS(reviews/T3.1_offline.md)
  - manifest(start_url·scope `/edulleo/`, 아이콘), service worker 프리캐시: 앱 셸 + 3개 언어 사전 + 원도심 JSON + SVG 약도(T5.1부터 전통시장 콘텐츠·두 코스 경로 JSON도 앱 JS에 포함되어 함께 프리캐시). OSM 타일은 프리캐시 제외
  - "오프라인 준비 완료" 조건: 프리캐시 목록 전부 캐시됨 → 설정 화면에 표시
  - 새 버전 배포 시 캐시 갱신(업데이트 토스트)
  - 완료 조건 [배포 전]: preview에서 ① "오프라인 준비 완료" 표시 → 네트워크 차단 → 새로고침 → 미방문 화면 포함 전 화면 열림, ② 업데이트 토스트 확인(빌드 A preview 접속 → 빌드 B로 다시 build·preview → 새로고침 시 토스트 → 새 버전 적용, 수동 확인). [배포 후] 조건 없음 → 이 시점에 체크
- [x] **T3.2 성능·접근성 점검** — T3.1 후 고정한 빌드를 측정. 수정이 필요하면 coordinator가 해당 파일 담당 task로 되돌림 — 2026-11-23 · reviews/T3.2_metrics.md 4회차(커밋 5f88faa) 기준 미달 0 · reviews/T3.2_r2_verdict.md (미해결 0)
  - 첫 로드 JS gzip 200KB 이하(빌드 리포트), Fast 4G·캐시 없음 기준 첫 화면 3초 이내, Lighthouse 접근성 90 이상
  - axe 검사(대비) + 모든 버튼 44px 자동 검사 스크립트를 Lighthouse와 함께 실행
  - 완료 조건: 측정 결과를 `reviews/T3.2_metrics.md`에 기록, 기준 미달 0
- [x] **T3.3 배포·QR** (병렬) — 소유: `.github/workflows/`, `app/public/qr.png`, `app/public/qr.svg`, `deck/`, `.gitignore`의 `!/deck/` 1줄(0.3절 허용 목록 반영) — 2026-11-23 · reviews/T3.3_r2.md (미해결 0) · [배포 후] 사용자 안드로이드 휴대폰으로 슬라이드 QR 스캔 → 앱 열림 확인(배포 커밋 b352c03)
  - 배포 URL QR 이미지 생성(시연 자료용 PNG·SVG). 배포 URL은 고정값이므로 배포 전에 만듦
  - 완료 조건 [배포 전]: QR 이미지 생성, 시연 자료(발표 슬라이드)에 QR 삽입
  - 완료 조건 [배포 후]: `main` 배포 확인, 슬라이드 화면의 QR을 실제 휴대폰으로 스캔 → 앱 열림 → smoke 뒤 체크 (0.3절 3-f)

**Phase 3 E2E:** `vite preview` 대상 Phase 2 시나리오 재실행 + 오프라인 시나리오("오프라인 준비 완료" 표시 대기 → 네트워크 차단 → 새로고침 → 미방문 장소 상세·문장 모음·약도 표시). 통과 후 0.3절 공통 4~6(smoke에 Phase 3 이후 항목 포함) → 3-f.

---

## Phase 4A — 시연 준비 (지금, 현장 확인 불필요)

> 순서: 0.3절 4A-a~4A-d를 따르며, 0.1절 'phase 단위 검증'보다 우선합니다. 대상은 Phase 3 배포본(예시 정보 + "현장 확인 전 · 예시 정보" 표시)입니다. **4A 완료 = 확인 전 표시 상태로 심사 시연 가능(PRD 4장 v0.6 예외, 사용자 결정 U-4): 최종 4A 기준 커밋에서 T4.3·T4.5가 체크되고 정정·삭제 연락처가 표시된 상태. 현장 정보 검증 완료를 뜻하지 않습니다.**

- [x] **T4.3 실기기 점검** [배포 후] — 0.3절 **4A 기준 커밋**(Phase 3 배포본, 4A 중 재배포 시 그 커밋) 해시를 `reviews/T4.3_devices.md`에 먼저 기록. 예시 정보 + "현장 확인 전" 표시 상태에서 점검 — 2026-11-23 · reviews/T4.3_devices.md (4A 커밋 b352c03, 필수 경로 정상, TalkBack·iOS 미검증)
  - 확보 기기: 안드로이드 + 크롬(진행자 시연 기기) — QR 접속, TTS 한국어 음성, 마이크 권한, 인식, 오프라인, Start walking 네이버 지도 도보 경로 표시. PC 크롬/엣지 — 운영자 리포트
  - iOS 사파리는 **미검증**으로 기록. 심사위원 iPhone은 텍스트·직원 화면 완주 경로로 대응
  - 실제 사용한 기기·OS·브라우저 버전 기록
  - 실제 음성 경로 증거는 이 문서가 유일하며, 자동 E2E는 목 기반임을 명시
  - 실측 시나리오(T1.5 R1·R2 판정 이관). 각 항목의 조건·결과·소요 시간을 기록:
    ① 마이크 권한 첫 요청과 재방문(허용 기억) 각각 `start()` 호출 → `onstart`까지 전체 시간(requesting 15초 기한 적정성 판단)
    ② 콜드 스타트(브라우저 새로 열기) 직후 첫 화면에서 한국어 음성 검출 여부, `voiceschanged` 도착 시점, 안내 표시가 맞는지
    ③ 단어 칩 연속 탭(3회 이상 빠르게)에서 이전 발화가 끊기고 재생 표시가 마지막 칩에만 남는지, TTS `interrupted` 이벤트 순서
    ④ 기내 모드(오프라인)에서 말하기 연습 → 실제 STT 실패 → "직원에게 보여주기" → 응답까지 완주
    ⑤ `navigator.userActivation` 지원 여부(지원 여부는 trusted tap 발화 성공을 대신하지 않으므로 ③에서 실제 발화로 확인)
    ⑥ 접근성(T2.0 R2 판정): 안드로이드 TalkBack에서 토스트 문구가 읽히는지, 바텀시트가 열렸을 때 뒤 화면으로 초점이 가지 않는지. 단어 칩·듣기 버튼의 한국어 이름이 TalkBack에서 한국어로 읽히는지(T2.4 R1 이관 — 안 되면 공용 ListenButton에 lang 지원 추가)
    ⑦ 네이버 지도 웹 도보 길찾기(T2.2 R1 판정): 안드로이드 크롬에서 네이버 지도 앱이 설치된 경우와 없는 경우 각각 "다음 정류장" 링크가 도보 경로로 열리는지
- [x] **T4.5 시연 리허설** [배포 후] — T4.3과 같은 4A 기준 커밋(해시 기록) 대상, 예시 정보 상태로 진행. 리허설에서 수정이 생기면 0.3절 4A-c를 따름 — 2026-11-23 · reviews/T4.5_rehearsal.md (4A 커밋 b352c03, 진행자 150초·심사위원 경로·비상 시나리오 완료)
  - 합격 조건: 안내 없이 180초 이내 완주, 진행자 음성 경로와 심사위원 텍스트 경로 각 1회
  - 비상 시나리오(인식 실패 → 직원 화면) 연습
  - 영상 정합성: 최종 4A 기준 커밋과 T2.7 녹화 커밋(`reviews/T2.7_render.md`)을 비교해, 그 사이 앱 변경이 영상 장면(영어 UI·한국어 주문 문장·직원 화면 등)에 나오면 해당 장면만 재녹화·재렌더(T2.7 규칙, 앱 재배포 불필요). 영향이 없으면 '4A 영향 장면 없음 (비교 커밋 a..b)'을 `reviews/T2.7_render.md`에 기록
- [ ] **T4.2 번역 원어민 검수 [사용자]** — 일본어·중국어 UI 문구, 문장 뜻, 가타카나 표기, 수량 칩 뜻(人前·杯·碗·人份 — T1.3 R1), 음성 가이드 원고 `data/guides.ts`(T6.15 추가). 가능할 때 진행하며, 결과는 4A(T4.2a) 또는 4B(T4.1a)에서 반영
- [ ] **T4.2a 4A 반영(번역·연락처)** — 담당: coordinator (검토 루프 적용). T4.2 결과 또는 T4.4c 연락처가 4A 중에 오면 수행. 번역이 4A 중에 오지 않으면 번역은 4B의 T4.1a에서 반영(연락처만 반영했으면 그것으로 체크, 둘 다 없으면 '해당 없음'으로 체크)
  - 번역: T4.1a의 'T4.2 결과' 반영 규칙(①~③)을 그대로 적용
  - 연락처: T4.4c에서 확정한 값을 `app/src/screens/Settings/contact.ts`의 `TAKEDOWN_CONTACT`에 반영(현재 `null`)
  - 완료 조건 [배포 전]: 반영 완료, 교정 항목별 반영 파일을 `reviews/T4.2a_fix.md`에 기록, 검토 미해결 0건. 배포는 0.3절 4A-d에서 수행
- [ ] **T4.4c 정정 연락처 확정 [사용자]** (4A) — 정정·삭제 요청용 연락처 1개(예: 프로젝트용 이메일, 값은 사용자가 정함)를 정해 coordinator에 전달. 반영은 T4.2a(0.3절 4A-d)
- [ ] **T4.6 심사 일정 확정 [사용자]** — 일정에 맞춰 Phase 3·4 일정 역산

---

## Phase 4B — 콘텐츠 확정 (현장 확인 후)

> 순서: 0.3절 4B-a~4B-f를 따르며, 0.1절 'phase 단위 검증'보다 우선합니다. T4.1 현장 확인 → T4.1a 반영·검토 루프(배지 자동 전환) → E2E·배포·smoke → T4.7 영상 갱신 → T4.3b·T4.5b 짧은 재점검

- [ ] **T4.4 가게 안내 [사용자]** (4B, 현장 방문 때) — 실제 상호 사용 안내·동의 여부 확인. 현장 방문(T4.1) 때 함께 진행(사용자 결정 U-5). 정정 연락처는 4A의 T4.4c로 분리됨
- [ ] **T4.1 현장 확인 [사용자]** — PRD 11장: 8곳(원도심 4 + 시장 4, T6.15 확장) 메뉴·가격·영업시간·휴무일·주문 방식, 주소·좌표, 광천식당 사리 명칭·단독 주문 여부, 메뉴별 알레르기 정보(T1.1 R1)
- [ ] **T4.1a 검증 결과 반영** — 담당: coordinator (검토 루프 적용)
  - T4.1 결과 → `downtown.json`·`market.json` 갱신: 확인한 장소만 장소 `verified:true`와 `checkedAt`(실제 확인일), 확인한 메뉴만 메뉴 `verified:true`. 확인 못 한 항목은 `false` 유지. 주소·좌표 확정 후 도보 시간·총거리 재계산
  - T4.2 결과(4A의 T4.2a에서 반영하지 않은 경우) → 영향받는 곳에 모두 반영: ① `i18n/*.json`(UI 문구) ② `downtown.json`·`market.json`의 해당 `meaning`·`words[].meaning`·`kana`, `data/guides.ts` 가이드 원고(일본어·중국어) ③ 수사 표기 변경 시 task.md 검수표 + `numerals.ts`·`orderSentence.ts`와 대응 테스트 기대값. 변경 없는 파일은 건드리지 않음
  - T4.4c 연락처를 4A(T4.2a)에서 반영하지 못한 경우 → `app/src/screens/Settings/contact.ts`의 `TAKEDOWN_CONTACT`에 반영. T4.4 가게 안내 결과(동의 거절·정정 요청 등)가 있으면 해당 내용도 반영
  - 완료 조건 [배포 전]: 반영 완료, 교정 항목별 반영 파일을 `reviews/T4.1a_fix.md`에 기록, 검토 미해결 0건. 배포는 완료 조건이 아니며 0.3절 4B-c에서 수행
- [ ] **T4.7 시연 영상 갱신 (T2.7 재실행)** — 소유: `video/`. 4B 기준 커밋에서 T4.1a로 바뀐 화면이 나오는 장면만 재녹화·재렌더(0.3절 Phase 2.5 규칙)
  - 완료 조건: T2.7 완료 조건과 같음. 녹화 커밋 해시와 재녹화 장면 목록을 `reviews/T2.7_render.md`에 기록(영향 장면이 없으면 '영향 장면 없음' 기록)
- [ ] **T4.3b 실기기 짧은 재점검** [배포 후] — 0.3절 **4B 기준 커밋** 해시를 `reviews/T4.3_devices.md`에 추가 기록. T4.1a 변경 영향 범위(확인 배지 전환, 바뀐 메뉴·가격·문구, 도보 시간)만 T4.3 항목 중 해당하는 것으로 재확인
- [ ] **T4.5b 시연 짧은 재리허설** [배포 후] — T4.3b와 같은 4B 기준 커밋 대상. 리허설에서 수정이 생기면 0.3절 4B-b로 돌아감
  - 합격 조건: 안내 없이 180초 이내 완주, 시연 영상의 녹화 커밋 = T4.1a 배포 커밋(또는 '영향 장면 없음'을 `reviews/T2.7_render.md`에 기록)

---

## Phase 5 — 확장 데모 (사용자 요청 2026-11-24)

- [ ] **T5.1 전통시장 코스(대전중앙시장)·시즌 카드·코스 여러 개 구조** — 소유: `data/*`, `screens/Course*`, `screens/Home*`, `screens/Phrases*`, `screens/Place/index.tsx`, `screens/Report/index.tsx`, `ui/map/*`, `router/routes.ts`, `types.ts`, `scripts/gen-course-route.mjs`
  - 근거: 최근 1년 블로그(2025.12 맛집 정리)·맛집 매거진(식신)·뉴스(2026.8 토토즐 푸드페스타) 검색. 인스타그램 등 SNS 원문은 직접 확인 못 함. 메뉴·가격·영업시간·좌표는 현장 확인 전 예시(데이터 note에 출처·불확실성 기록)
  - 데이터: `data/market.json`(hub station, theme market, start 대전역, events 토토즐) + `data/market.route.json`(`node scripts/gen-course-route.mjs market`, 352+113+54+159m). `courseRoute.json` → `downtown.route.json`. 로드 시 코스별 검증 + 코스 사이 장소·메뉴·문장 ID 중복 검사
  - 코스 4곳: 수연분식(고추튀김·떡볶이) → 개천식당(만둣국·찐만두) → 생일집(순대국밥·고기순대, 돼지고기 표기) → 홍가네풀빵(풀빵). 장소마다 문장 3개(돼지고기 들어가요? 등)
  - 화면: 홈 대전역·소제동 카드 열림(DEMO·Traditional Market) → `/course?c=jungang-market`. 코스 화면은 `?c=`로 코스 선택(없거나 모르면 원도심), 시즌 카드(SeasonCard·season.ts). 장소 상세 "STOP n OF 코스 장소 수"·뒤로가기 → 그 코스. 문장 모음 코스별 묶음. 운영자 리포트 정렬은 코스 순서 → 방문 순서
  - 지도: 시장처럼 가까운 핀은 터치 영역(44px)이 겹치지 않게 화면 좌표로 벌림(약도·타일 지도)
  - Codex 교차 검증 R1~R5 완료(2026-11-24, 미해결 0): reviews/T5.1_r1~r5.md · 판정·수정 기록 *_verdict.md·*_fix.md (R1 M3 L4 → R2 M1 L1 → R3 M1 → R4 M1 → R5 0). T2.2b 범위 포함
  - (당시 기록) 남은 것: 수량 단위 '그릇'(국밥·만둣국은 현재 '개'), 메뉴 그림(빵 아이콘 공용), 현장 확인(위치·메뉴·가격·영업시간·포장 여부), 행사 다음 시즌 일정, T4.2 번역 시트에 새 문구·데이터 추가, E2E(시장 코스 경로) 추가, Codex 교차 검증
  - 현재 상태(2026-11-26, T6.15): 구현·Codex R1~R5 검토 완료(4738d8d). 메뉴 아이콘은 Phase 6에서 없어져 해당 없음. 체크 전 남은 인수 조건 = 수량 단위 '그릇', 시장 코스 E2E, 현장 확인(T4.1에 포함), 행사 다음 시즌 일정, 번역 검수(T4.2에 포함)

## Phase 6 — 디자인 개편 (C 새안 · 사용자 확정 2026-11-26)

> 기준: `DESIGN.md` v1.1(계획 당시, 현재 v1.2), `PRODUCT.md`, 디자인 진단 `.impeccable/critique/`(25/40), 시안 `mockup/redesign/`. 계획 검토: `reviews/P6_plan_r1.md`·`_verdict.md`.
> 원칙: **기능·데이터·문구 의미는 그대로, 보이는 모습과 화면 구성만 바꿈.** 단, 진단에서 나온 사용성 문제(주 버튼 순서, 반복 안내, 남는 알림 등)는 함께 고침. 기존 `data-testid`는 유지하고, 바꿀 수밖에 없으면 해당 task에서 테스트를 같이 고칩니다. 기존 동작을 기대하는 테스트는 지우지 않고, 바뀐 동작만 갱신합니다.
> 순서: T6.D(문서, coordinator) → T6.0(기반) → T6.1~T6.6(병렬 묶음 C: 6개 동시) → 번역 패치 일괄 재적용 → T6.7(phase 검증·배포).
> **번역 파일 규칙(0.2절 예외):** 병렬 묶음 동안 worker의 tsc·테스트 결과는 **잠정**입니다(다른 worker의 동시 적용으로 일시 실패할 수 있음). worker 완료 판정은 coordinator가 모든 패치를 직렬 재적용하고 쓰기가 멈춘 상태에서 tsc·그 task 테스트·i18n 검사를 다시 돌려 통과한 뒤에 합니다. `i18n/en.json`·`ja.json`·`zh.json`은 병렬 task가 직접 쓰지 않습니다. 각 task는 자기 이름공간 키를 `app/src/i18n/patches/T6.x.json`(형식 `{ "en": {...}, "ja": {...}, "zh": {...} }`, 중첩 키)에 적고, `node app/scripts/i18n-patch.mjs <패치>`로 적용해 자기 테스트를 돌립니다(읽고-합치고-쓰기를 한 번에 하는 작은 스크립트, T6.0이 작성). 병렬 묶음이 끝나면 coordinator가 모든 패치를 순서대로 다시 적용(같은 결과가 나오는 멱등 병합)하고 3개 언어 키 일치 검사를 돌립니다. 패치 파일이 번역의 원본입니다. `--check`는 잠금 없이 읽으므로, 최종 `--check`·검증은 모든 패치 적용이 끝난 뒤(쓰기가 없는 상태)에 실행합니다(T6.7 R1 L-01). 잠금이 남아 종료 코드 4가 나면 coordinator에게 알리고, coordinator가 다른 작업이 없을 때 `node app/scripts/i18n-patch.mjs --break-lock`으로 정리합니다(소유 PID가 살아 있으면 거부).
> **공용 파일:** `types.ts`·`router/*`(T6.0의 알림 정리 제외)는 coordinator 단독. 화면 task가 바꿔야 하면 멈추고 요청합니다.

- [x] **T6.D 기준 문서 정리 (coordinator)** — 2026-11-26 · reviews/P6_plan_r1~r4.md (R4 미해결 0) · 커밋 39da3a4(Phase 6 통합 커밋) — 소유: `prd.md`, `DESIGN.md`, `PRODUCT.md`, `.gitignore`, `mockup/redesign/*`
  - prd.md 갱신: 사진·로고 사용(사용자 결정 2026-11-26, 사진 출처 표시 의무), 디자인 기준 문서 `DESIGN.md` 참조, 대비 4.5:1 유지, 확인 전 안내 정책(모두 미확인 = 요약 한 줄 / 혼합 = 장소별 표시, 비제휴·알레르기·가격 미정·확인일 유지), 인트로 화면(S00 언어 선택 대체), 코스 길찾기 버튼 첫/다음 정류장 규칙 유지
  - prd.md F-02·S01 홈 구성 갱신(오늘의 코스 → 원도심 카드, 오늘의 문장·1박 배너 홈에서 제거, 문장 듣기·모음은 기존 경로 유지), 실제 상호 위험 표에 사진 속 간판·인물 권리 경계
  - `.gitignore` 허용 목록에 `DESIGN.md`, `PRODUCT.md` 추가(`.impeccable/`는 올리지 않음). 시안 그림은 `mockup/redesign/`(허용 목록 안), 시안별 사진 출처 연결 `mockup/redesign/CREDITS.md`. **시안 PNG는 CREDITS 작성 뒤에만 커밋**
  - 완료 조건: Codex 문서 검토 미해결 0

- [x] **T6.0 디자인 기반 (색·글자·공용 UI·로고·사진·번역 도구)** — 2026-11-26 · reviews/T6.0_r1~r3.md (R3 미해결 0) · 사용자 결정: 사진 3장 얼굴 흐림 후 사용 · 범위 예외: `Settings.test.tsx` 2줄(nav.me 값 변경) · 커밋 39da3a4(Phase 6 통합 커밋) — 소유: `styles/*`, `ui/*`(map 제외), `sw/updateToast.css`, `public/*`, `index.html`, `vite.config.ts`(사전 캐시 패턴만), `data/photos.ts`(신설), `i18n/hardcodeCheck.ts`(브랜드 허용 목록만)와 그 테스트, `ui/map/sketchConstants.ts`(색 값만)와 `SketchMap.test.tsx`(색 일치 검사만), `scripts/i18n-patch.mjs`(신설), `router/AppRoutes.tsx`(알림 정리만) · 문구 `nav.*`·`common.*`·`photo.*`(패치 `T6.0.json`)
  - `tokens.css`를 DESIGN.md 2장 토큰으로 교체. 옛 토큰 이름(`--acc`·`--acc-d`·`--sea`·`--soft`·`--paper`·`--ink2` 등)은 새 값으로 **호환 대응**시켜 화면 task 전에도 모든 화면이 새 색으로 빌드·표시되게 함. `ui/a11y.ts` 대비 검사 대상 색 쌍을 새 토큰으로 갱신
  - 공용 UI(Button·Card·Pill·TabBar·TopBar·Toast·Sheet·IconButton·ListenButton·Pronunciation·ReportSheet, `styles/ui.css`)를 DESIGN.md 3·6·8장에 맞춤. 기존 props·variant 이름(`ink|acc|sea|ghost` 등)은 유지하고 색만 대응(화면 코드가 그대로 컴파일). 굵기 800 제거. `ui/Logo.tsx`(e 우회로 SVG + 글자 로고) 추가
  - 글자: `index.html`에서 Fraunces 제거, IBM Plex Mono(500·600) 추가, `Pretendard Variable` 유지. 숫자용 유틸 클래스(`.num`)
  - 탭바 5번째 표시 이름을 화면 제목과 같게(EN "Settings", JA "設定", ZH "设置"; `nav.me` 키 유지, 값만 변경)
  - 로고 파일: `public/favicon.svg`, PWA 아이콘 4종 재생성, `manifest.webmanifest`·`index.html`의 `theme-color #1D5BD6`, `background_color #F4F7FB`. hardcodeCheck 브랜드 허용 목록에 `edulleo`·`에둘러` 추가(검사 완화 없이, 테스트 추가)
  - 사진: 권리 점검(아래)을 통과한 사진만 `public/photos/*.webp`(긴 변 ≤1200px, ≤200KB)로 넣고(현재 후보 6장) `data/photos.ts`에 DESIGN.md 5장 필드 전부, `public/photos/CREDITS.txt`에 같은 내용. 사진 조회 함수(장소 id·권역 id → 사진)와 타입을 `data/photos.ts` 안에 확정. 6장 원본 페이지의 저작자·라이선스·고지를 다시 확인해 기록. `vite.config.ts` 사전 캐시 패턴에 `webp` 추가
  - 알림: 경로가 바뀌면 일반 알림(Toast)만 닫음. SW 업데이트 안내는 유지(`sw/updateToast.css`는 새 토큰으로)
  - 번역 도구: `scripts/i18n-patch.mjs` — 프로세스 간 잠금(잠금 디렉터리, 대기·재시도·오래된 잠금 정리), 잠금 안에서 세 언어 파일을 임시 파일에 쓴 뒤 연달아 rename, 이미 있는 키에 다른 값을 넣으면 오류(같은 값은 통과 = 멱등, 의도적 변경은 패치의 `$override` 목록으로). 스크립트 테스트(중첩 병합·반복 적용·기존 키·순서 보존·충돌 감지·override). 라이선스명·저작자는 번역 키가 아니라 `data/photos.ts`
  - 사진별 권리 점검: 원본 페이지의 별도 제한·주의 표시, 식별 가능한 인물, 간판·로고가 주제인지 확인해 `photos.ts`의 `review` 필드에 기록. **불확실하면** 그 사진은 쓰지 않고(public·사전 캐시에서도 제외) 글자 타일로 대체, 제외 목록·사유를 `photos.ts` 주석과 작업 보고에 기록. 원본 고지(EXIF Copyright 등)는 `notice`에 그대로
  - 완료 조건: tsc·lint·Vitest 통과(색·글꼴 값에 묶인 기존 테스트만 갱신), `npm run build` 성공, 사전 캐시 목록에 점검 통과 사진 전부 포함(제외 사진은 없음 확인)·각 크기·총 증가량 기록

- [x] **T6.1 인트로 (첫 실행 화면, 언어 선택 대체)** — 2026-11-26 · reviews/T6.1_r1~r2.md (R2 미해결 0) · coordinator 직렬 재검증(패치 7개 재적용·tsc·lint·Vitest 1030) 통과 · 커밋 39da3a4(Phase 6 통합 커밋) — 소유: `screens/Lang/*` · 문구 `lang.*`(패치 `T6.1.json`)
  - DESIGN.md 7장 '인트로'. 경로 `/lang`, `data-testid="screen-lang"`, 언어 버튼 `lang-en|ja|zh`, 시작 버튼 문구 키 `lang.start`, 시작 전 언어 저장 동작 유지(E2E `chooseLanguage` 그대로 통과)
  - 기능 안내판 3장면(코스·주문·직원), 약 4.4초 자동 전환, 장면 탭으로 이동하면 자동 재생 멈춤, 재생/일시정지 버튼(키보드·`aria-pressed` 등 상태 전달). 장면마다 한 줄 설명(3개 언어). 특정 메뉴 예시 문장 없음
  - 언어 버튼을 누르면 즉시 그 언어로 문구가 바뀜(기존 동작), 발음 안내 문구(`lang.pronRoman`/`pronKana`) 유지
  - 움직임 줄이기면 자동 재생 없음. 화면을 떠나면 타이머 정리
  - 완료 조건: Lang 단위 테스트 갱신·통과(장면 이동, 탭 시 자동 재생 멈춤, 재생/정지, 움직임 줄이기, 언어 전환), hardcodeCheck 통과

- [x] **T6.2 홈** — 2026-11-26 · reviews/T6.2_r1~r2.md (R2 미해결 0) · coordinator 직렬 재검증(패치 7개 재적용·tsc·lint·Vitest 1030) 통과 · 커밋 39da3a4(Phase 6 통합 커밋) — 소유: `screens/Home/*` · 문구 `home.*`(패치 `T6.2.json`)
  - DESIGN.md 7장 '홈': 1호선 세로 노선 위 3권역 사진 카드. `HubArt` 삽화·가로 캐러셀·인사말·1박 배너·오늘의 문장 블록 제거(오늘의 코스는 원도심 카드가 대신). 쓰지 않게 된 `home.*` 키는 패치에서 지우지 않고 남겨 둠(T6.7에서 정리 여부 결정)
  - `data-testid` `screen-home`·`hub-downtown`·`hub-station`·`hub-yuseong` 유지, 유성 누르면 "준비 중" 알림 유지
  - 사진 출처 한 줄(`data/photos.ts`), 야시장 한 줄은 `screens/Course/season.ts` 판단을 import해 재사용(기간 밖이면 숨김)
  - 완료 조건: Home 단위 테스트 갱신·통과

- [x] **T6.3 코스** — 2026-11-26 · reviews/T6.3_r1~r2.md (R2 미해결 0) · coordinator 직렬 재검증(패치 7개 재적용·tsc·lint·Vitest 1030) 통과 · 커밋 39da3a4(Phase 6 통합 커밋) — 소유: `screens/Course/*`, `ui/map/*` · 문구 `course.*`(패치 `T6.3.json`)
  - DESIGN.md 7장 '코스': 지도 밝게, 경로선 파랑+흰 테두리, 핀 흰 바탕+파란 테두리, 구간 분 칩, 오프라인 약도도 같은 색 체계
  - 정류장 목록: 사진 썸네일(없으면 글자 타일), 분·영업시간 고정폭, 확인 전 안내는 DESIGN.md 6장 정책, 사진 출처 한 줄
  - 아래 고정 길찾기 버튼: 방문 기록 없으면 "Start with stop 1", 있으면 기존 `nextStop` 문구·주소 그대로(네이버 지도·대체 경로 유지) (T6.13에서 버튼 위 행선지 선택 추가, 처음 선택 = 이 규칙의 정류장)
  - 완료 조건: Course·map 단위 테스트 갱신·통과(두 코스 × 첫 진입/중간 방문/마지막 정류장 버튼 상태 포함), 오프라인 약도 표시 유지

- [x] **T6.4 장소** — 2026-11-26 · reviews/T6.4_r1~r2.md (R2 미해결 0, R1 M-01 E2E는 T6.7) · coordinator 직렬 재검증(패치 7개 재적용·tsc·lint·Vitest 1030) 통과 · 커밋 39da3a4(Phase 6 통합 커밋) — 소유: `screens/Place/*` · 문구 `place.*`·`menu.*`(패치 `T6.4.json`) · `Order/QtyStepper`는 import만
  - DESIGN.md 7장 '장소': 사진 머리(사진 없으면 파란 글자 머리, `PlaceArt` 삽화 제거) + 사진 출처, 진행 표시, 탭(주문 가능한 장소만 Menu, 비주문 장소 메뉴 탭 숨김 유지), 메뉴 줄 선택 표시, 가격 미정·알레르기 미정은 중립 회색
  - "지금 닫힘"은 빨강 대신 중립색 + 계산 가능할 때 다음 영업 시각, 확인 전 안내는 장소당 한 줄(비제휴 안내·알레르기·가격 표시는 유지)
  - 떠 있는 버튼은 담은 메뉴가 있을 때 주문 바만(떠 있는 연습 버튼 제거). Phrases 탭 → 연습 진입 계약은 유지
  - 완료 조건: Place 단위 테스트 갱신·통과(제거한 떠 있는 연습 버튼 기대만 갱신, 문장 탭 → 연습 테스트 유지)

- [x] **T6.5 주문·직원·응답** — 2026-11-26 · reviews/T6.5_r1~r2.md (R2 미해결 0) · coordinator가 `i18n/staffKo.ts`에 sampleTotal 추가 · coordinator 직렬 재검증(패치 7개 재적용·tsc·lint·Vitest 1030) 통과 · 커밋 39da3a4(Phase 6 통합 커밋) — 소유: `screens/Order/*`(QtyStepper 포함, props 호환 유지), `screens/Staff/*`, `screens/Reply/*` · 문구 `order.*`·`staff.*`·`reply.*`(패치 `T6.5.json`)
  - 주문: 주 버튼 "Show to staff"(파랑), 보조 "Practice saying it". 문장 카드·Listen 연파랑
  - 직원: 상단 짙은 파랑 띠, 흰 화면, 아주 큰 한국어 문장, 응답 버튼(네 = 파랑 채움). 한국어 고정 문구 유지
  - 응답: 응답마다 다음 행동이 보이게(품절 → 주문 수정, 네 → 완료 흐름 유지). `reply.yesTitle`의 이모지 제거
  - 완료 조건: Order·Staff·Reply 단위 테스트 갱신·통과

- [x] **T6.6 연습·결과·문장 모음·저장·설정** — 2026-11-26 · reviews/T6.6_r1~r3.md (R3 미해결 0) · DESIGN.md 8장 녹음 중 표시 예외 · 범위 예외: Report 굵기·숫자 글꼴 · coordinator 직렬 재검증(패치 7개 재적용·tsc·lint·Vitest 1030) 통과 · 커밋 39da3a4(Phase 6 통합 커밋) — 소유: `screens/Practice/*`, `screens/Result/*`, `screens/Phrases/*`, `screens/Saved/*`, `screens/Settings/*`, `screens/Report/*`(색만) · 문구 `practice.*`·`result.*`·`phrases.*`·`saved.*`·`settings.*`(패치 `T6.6.json`)
  - 같은 색·글자·버튼 체계. 저장 빈 화면에 저장 방법 안내
  - 설정: 운영자 리포트·데모 초기화를 '시연 도구' 묶음(접힘)으로, **사진 출처**는 새 경로 없이 설정 안의 시트(Sheet)로(제목·저작자·라이선스 링크·원본 링크·원본 고지·변경 내역, `data/photos.ts`에서 읽음). 정정 연락처 표시 유지
  - 운영자 리포트(S13, 한국어 고정·데스크톱)는 색만 새 토큰으로
  - 완료 조건: 해당 화면 단위 테스트 갱신·통과(사진 출처 시트 열기·닫기·뒤로가기·초점 복귀 포함)

- [x] **T6.7 Phase 6 검증·배포 (coordinator)** — 2026-11-26 · reviews/T6.7_verify.md·T6.7_fix.md·T6.7_r1~r2.md (R2 미해결 0) · Vitest 1036·E2E 75·detect 0 · 커밋 39da3a4 → main 배포(Deploy·CI 성공) · smoke: HTTPS 200, 사진·아이콘·manifest·CREDITS 200, SW 범위 /edulleo/, 온라인 콘솔 오류 0, 오프라인 새로고침 시 사진 표시(오프라인 때 Google Fonts 요청 실패 1건은 시스템 글꼴 대체로 의도된 동작) — 소유: `e2e/*`, `README.md`, `i18n/*.json`(패치 일괄 재적용)
  - 번역 패치 전부 재적용 → 3개 언어 키 일치 검사 → tsc·lint·Vitest 전체
  - Playwright E2E 전체(75개) 갱신·통과. 바뀐 동작만 갱신
  - **검증표(EN/JA/ZH × 360×780·430×932 스크린샷):** 인트로 3장면·재생/정지·시작 버튼 / 홈 3권역(야시장 기간 안·밖) / 코스 두 종류 × 온라인 지도·오프라인 약도 × 첫/중간/마지막 버튼 / 장소 사진 있음·없음·비주문 장소·긴 이름·가격 미정 / 주문·직원(여러 메뉴 긴 문장·큰 글씨) / 응답 4종 / 설정 사진 출처 시트. 판단 기준: 가로 넘침 없음, 고정 버튼이 내용을 가리지 않음, 세로 스크롤로 모두 닿음, JA·ZH 끝 글자 하나만 떨어지는 줄바꿈 없음
  - 사진 위 글자 대비: 실제 렌더에서 글자 뒤 최악 배경과 합성한 대비 4.5:1 이상(사진 출처 11.5px 포함)
  - 오프라인: 사전 캐시 후 오프라인 새로고침 → 사진 표시(디코드 성공), 글꼴 캐시가 없을 때 시스템 글꼴로 깨짐 없이 표시
  - impeccable 자동 검사(detect)로 남은 AI 기본값 패턴 확인
  - 빌드 → preview E2E → 사용자 요청 시 커밋·main 병합·배포 → smoke(`/edulleo/` 아래 사진·아이콘 로드, 오프라인 새로고침 시 사진 표시)
  - 시연 영상·발표 덱의 화면은 이번 범위 밖(사용자 지시 '영상은 아직 만들지 말어')

- [x] **T6.8 앱을 열 때마다 인트로 (사용자 요청 2026-11-26)** — 2026-11-26 · reviews/T6.8_r1~r2.md (R2 미해결 0) · Vitest 1040·E2E 81 · 커밋 e947a50(T6.9와 함께) → main 배포(Deploy·CI 성공) — 소유: `router/AppRoutes.tsx`·`router/launchIntro.ts`(신설)·`test/setup.ts`, `e2e/support.ts`·`s5`·`s6`·`s8`(신설), 문서 prd.md S00·DESIGN.md 7장
  - (사용자 요청 '항상'을 coordinator가 이렇게 구현) 페이지를 새로 열어 처음 그리는 화면이 홈이면 언어를 골랐어도 인트로(`/lang`) 먼저. 언어 미선택이면 어느 주소든 기존처럼 인트로 → 홈. PWA 창 재개·뒤로가기 캐시 복원은 새로 불러온 것이 아니라 다시 안 나옴. 고른 언어는 그대로 선택돼 있고 시작 → 홈
  - 특정 화면 주소로 열거나 새로고침하면 그 화면 그대로(링크·새로고침 보존), 같은 페이지 안에서 홈으로 가도 다시 끼어들지 않음
  - 완료 조건: 단위 테스트(새로 연 홈 → 인트로, 지난 뒤 홈 이동, 특정 화면 주소), E2E S8(3개 언어) + 전체 E2E 통과, Codex 검토 미해결 0

- [x] **T6.9 사진 없는 5곳에 음식 예시 사진 (사용자 요청 2026-11-26)** — 2026-11-26 · reviews/T6.9_r1~r2.md (R2 미해결 0) · 결과: 3곳(개천식당 만둣국·생일집 순대국밥·홍가네풀빵 국화빵) 음식 예시 사진, 광천식당·수연분식은 블로그 출처 사진의 허락 근거 미확인으로 제외 → 글자 타일 유지(이 2곳은 T6.10에서 운영자 직접 촬영 사진으로 채움) · 커밋 e947a50(T6.8과 함께) → main 배포(Deploy·CI 성공) — 소유: `data/photos.ts`·`data/photoCredits.ts`·`public/photos/*`, `screens/Place/*`, `screens/Course/*`(사진 표시 부분), DESIGN.md 5장
  - 사용자 요청: 사진 없는 곳은 SNS 사진으로 → SNS 사진은 저작권상 공개 저장소·배포 사이트에 올릴 수 없어(coordinator 판단), 위키미디어 공용의 자유 이용 **음식 사진**으로 대체: 광천식당=두부두루치기(CC BY 2.0 KR), 수연분식=고추튀김(CC BY 2.0 KR), 개천식당=만둣국(CC BY-SA 2.0), 생일집=순대국밥(CC BY 2.0), 홍가네풀빵=국화빵(CC BY-SA 2.0 KR)
  - 그 가게에서 찍은 사진이 아니므로 사진 위·출처 줄에 "음식 예시 사진(이 가게 사진 아님)" 표시(3개 언어), 사진 출처 시트·CREDITS에도 구분
  - 완료 조건: 장소 머리·코스 썸네일에 5곳 사진 표시, 라이선스 기록(BY와 BY-SA 구분), 단위 테스트·E2E 통과, Codex 검토 미해결 0

- [x] **T6.10 광천식당·수연분식 직접 촬영 사진 등록 (사용자 요청 2026-11-26)** — 2026-11-26 · reviews/T6.10_r1~r3.md (R3 미해결 0) · Vitest 1062·E2E 81 · 커밋 f2d4b3d → main 배포(Deploy·CI 성공) — 소유: `data/photos.ts`·`data/photoCredits.ts`·`public/photos/*`, 관련 테스트, DESIGN.md 5장
  - 사용자가 직접 찍은 사진 2장(광천식당 정면 간판, 수연분식 간판). 광천식당 사진은 사용자가 운영하는 블로그에 올린 본인 사진임을 사용자가 확인(2026-11-26). 저작자 표기는 개인 이름 없이 "Edulleo 운영자(직접 촬영)", 앱 사용 허락(별도 CC 라이선스 아님)
  - 광천식당 사진 오른쪽 끝 행인 흐림 처리, 800px WebP
  - 완료 조건: 장소 머리·코스 썸네일에 실제 가게 사진(kind 'place'), 음식 예시 표시 없음, 출처·CREDITS·설정 시트에 저작자·이용 조건 표시, 테스트·E2E 통과, Codex 검토 미해결 0
- [x] **T6.11 사진 덜 가리기 + 대전역·소제동 시작 버튼 (사용자 요청 2026-11-26)** — 2026-11-26 · reviews/T6.11_r1~r3.md (R3 미해결 0) · Vitest 1063·E2E 81 · 커밋 65aa9ae(T6.12와 함께) → main 배포(Deploy·CI 성공) — 홈·장소 사진 위 막을 그라데이션(글자 줄 ≥0.62)으로, 카드·머리 높이 키움, 대전역 카드를 원도심과 같은 틀(코스 요약·출발 안내·Start the course → 시장 코스) — 소유: `screens/Home/*`·`screens/Place/place.css`·DESIGN.md 5장
  - 완료 조건: 홈·장소 사진 위 글자 줄 막 ≥0.62(흰 사진 최악 합성 대비 ≥4.5:1), 사진 위쪽은 막 없이 보임, 대전역·소제동 카드에 시작 버튼(→ 시장 코스, 한 번만 이동), 두 시작 버튼을 코스 이름으로 구분, 360px EN·JA·ZH 가로 넘침 없음, 테스트·E2E 통과, Codex 검토 미해결 0
- [x] **T6.12 대전근현대사전시관 사진을 운영자 직접 촬영 사진으로 교체 (사용자 요청 2026-11-26)** — 2026-11-26 · reviews/T6.12_r1.md (R1 미해결 0) · Vitest 1063·E2E 81 · 빌드 사전 캐시에 새 사진 포함 확인 · 커밋 65aa9ae(T6.11과 함께) → main 배포(Deploy·CI 성공) — 소유: `data/photos.ts`·`public/photos/*`, 관련 테스트(photos·Course·Settings), DESIGN.md 5장
  - 위키미디어 옛 충남도청 사진(Yoo Chung, CC BY-SA 2.5) 삭제 → `daejeon-modern-history-hall.webp`(800×600, 방문객 얼굴은 촬영자가 미리 흐림). 앞서 받은 '대전광역시 중구' 로고 사진은 공공누리 근거 미확인으로 쓰지 않음
  - 완료 조건: 장소 머리·코스 썸네일에 새 사진, 출처 '직접 촬영'(3개 언어)·설정 시트·CREDITS 반영, 옛 사진 출처 흔적 없음, 테스트·E2E 통과, Codex 검토 미해결 0
- [x] **T6.13 코스 길찾기 행선지 선택 (사용자 요청 2026-11-26)** — 2026-11-26 · reviews/T6.13_r1~r3.md (R3 미해결 0) · Vitest 1074·E2E 81 · 커밋 c11dbc1 → main 배포(Deploy·CI 성공) — 소유: `screens/Course/index.tsx`·`Course.css`·`Course.test.tsx`, `store/useAppStore.ts`(walkPicks·setWalkPick, 저장 안 함, resetData가 비움 — R2 M-01)·`useAppStore.test.ts`, 번역 패치 `i18n/patches/T6.13.json`(course.pickLabel·nextTag·dirTo), DESIGN.md 7장 코스, prd.md v0.12 F-03·S02
  - 사용자 요청: "walk to stop이 각각 정해져 있는데 가고 싶은 곳을 선택을 할 수 있도록 해줘. 선택을 하면 네이버 지도에서 선택한 곳까지 나타나도록"
  - 완료 조건: 버튼 위 라디오 2×2(처음 = 다음 정류장, 'Next' 표시는 다음 정류장에 고정 — 'Next' 표시는 T6.14에서 삭제), 고르면 버튼 문구·네이버 도보 길찾기·Google 장소 보기·안내 문구가 고른 곳으로, 두 코스 모두, 360px EN·JA·ZH 넘침 없음·칸 44px, 키보드(라디오 화살표)·초점 표시, 테스트·E2E 통과, Codex 검토 미해결 0
- [x] **T6.14 음성 가이드(코스·장소) + 'Next' 표시 삭제 (사용자 요청 2026-11-26, A안 = 휴대폰 내장 음성)** — 2026-11-26 · reviews/T6.14_r1~r3.md (R3 미해결 0) · Vitest 1161·E2E 81 · 커밋 7643986 → main 배포(Deploy·CI 성공) · 휴대폰 일본어·중국어 실제 소리는 사용자 확인 대기 — 소유: `data/guides.ts`(+test), `speech/guideTts.ts`(+test), `ui/GuidePlayer.tsx`·`.css`(+test), `ui/index.ts`, `screens/Course/*`, `screens/Place/index.tsx`·`place.css`·`index.test.tsx`, 번역 패치 `T6.14.json`(guide.*), prd.md v0.13 F-19, DESIGN.md 7장
  - 사용자 요청: "NEXT라는 주황색 박스는 삭제", "코스를 선택하면 여행가이드가 코스에 대한 부가 설명을 하는 형태", "각 장소… 대표메뉴·주문방법 등 설명", "각각 버튼으로 해서 누르면 들을 수 있도록… 팝업으로 내용도 글씨로", "영어·일본어·중국어 모두", "일본어 중국어도 꼭 소리가 나도록", "버튼은 이모지 없이 앱과 어울리게"
  - 완료 조건: 코스 2개·장소 8곳 원고 3개 언어(한글 없음·예시 정보 안내), 언어별 음성 고르기(없으면 lang 지정 시도 + 안내), 문장 단위 재생·강조·멈춤/이어 듣기·천천히, 닫기·화면 이탈·언어 변경 시 멈춤, 360px 3개 언어 넘침 없음, 테스트·E2E 통과, Codex 검토 미해결 0. 실기기(휴대폰) 일본어·중국어 소리 확인은 사용자 확인 항목
- [x] **T6.15 문서 정합화 (사용자 요청 2026-11-26)** — prd.md v0.14·DESIGN.md v1.2·PRODUCT.md·README.md·task.md를 현재 앱 기준으로 정리, Codex 교차 검토 (reviews/T6.15_*) — 2026-11-26 완료 · 개발 문서 reviews/T6.15_dev_r1~r3(미해결 0) · 대외 문서(사업계획서 2종·발표 덱·참가신청서 개편안·임시명세서) reviews/T6.15_extA_r1~r2·extB_r1~r2(미해결 0) · 앱 화면 캡처 8장(앱화면/, 이전 6장은 앱화면/이전_2026-11-23) · 참가신청서 HWP 본문은 원본 부재로 사용자 수동 반영 필요
- [x] **T6.16 인트로 그림 칸을 영상으로 (사용자 요청 2026-11-26)** — 2026-11-26 · reviews/T6.16_r1~r2.md (R2 미해결 0) · Vitest 1176·E2E 81 · 실기기(아이폰·안드로이드) 영상 재생은 사용자 확인 대기 — 소유: `screens/Lang/index.tsx`·`IntroStage.tsx`·`introMedia.ts`·`lang.css`·`Lang.test.tsx`, `scenes.tsx` 삭제, `public/intro/*`(intro.mp4·scene-1~3.webp), `vite.config.ts`(사전 캐시 mp4), DESIGN.md 7장 인트로, prd.md v0.15 S00. 영상 원본·만든 과정은 저장소 밖 `intro-film/`(Lemo-Opuscar Tabletop App Flythrough, TREATMENT·CREDITS·build.sh)
  - 사용자 결정: 칸 232px(추천), 탭을 누르면 그 장면으로 이동·자동 재생 멈춤·그 장면만 재생 후 정지(추천안), 오프라인 저장, 예전 SVG 정리, 무음·글자 없음·한 번에 이어지는 13.2초
  - 완료 조건: 영상 시간이 장면을 정함(타이머 어긋남 없음), 탭·일시정지·재생, 영상 실패·재생 거부·움직임 줄이기 → 정지 그림(+타이머), 오프라인 재생(blob URL), 390·360 화면 넘침 없음, 테스트·E2E 통과, Codex 검토 미해결 0
- [x] **T6.17 음성 가이드 글을 2문장씩 (사용자 요청 2026-11-26, A안)** — 2026-11-26 · reviews/T6.17_r1~r2.md (R2 미해결 0) · Vitest 1188·E2E 81 · 화면 reviews/T6.17_shots.jpg — 팝업에 원고 전체가 보여 너무 큼 → 2문장씩 보여 주고 다 읽으면 다음 2문장. 이전/다음·'전체 글 보기', 칸 높이 고정, 움직임 줄이기 대응 — 소유: `ui/GuidePlayer.tsx`·`GuidePlayer.css`·`GuidePlayer.test.tsx`, `ui/guideChunks.ts`(신설)·`guideChunks.test.ts`, 문구 `guide.prev·next·part·full·paged`(패치 `T6.17.json`), DESIGN.md 음성 가이드 줄, prd.md v0.16 F-19
  - 완료 조건: 문단 안 최대 2문장(언어별 길이 상한), 읽는 문장 따라 묶음 자동 전환(앞 묶음 즉시 숨김·겹침 없음), 이전/다음(재생 중이면 그 묶음부터)·'n / N'·전체 글 보기, 멈춤/이어 듣기·끝까지 읽으면 처음부터·오류·천천히·닫기/다시 열기·언어 변경 시 첫 묶음, 칸 높이 고정(넘길 때 팝업 크기 그대로), 움직임 줄이기 = 전환 없음, 3개 언어 화면 확인, 테스트·E2E 통과, Codex 검토 미해결 0

## 진행 현황 요약

(2026-11-26 실제 체크박스 기준으로 다시 셈. 하위 [사용자] 항목(T2.7 안의 edge-tts 확인)은 task 수에 넣지 않음)

| Phase | task 수 | 완료 | 병렬 |
|---|---|---|---|
| 0 기반 | 4 | 4 | 순차 |
| 1 데이터·도메인 | 7 | 7 | 6개 동시 |
| 2 화면 | 8 | 7 | T2.0 후 6개 동시 (T2.2b 미체크) |
| 2.5 시연 영상 | 1 | 1 | Phase 3과 병렬 |
| 3 오프라인·배포 | 3 | 3 | T3.1 → T3.2 순차, T3.3 병렬 |
| 4A 시연 준비 | 6 | 2 | 사용자 task 포함(T4.4c 연락처), T4.2a는 결과 도착 시 (T4.3·T4.5 완료) |
| 4B 콘텐츠 확정 | 6 | 0 | 현장 확인 후, 순차 |
| 5 확장 데모 | 1 | 0 | T5.1 미체크 |
| 6 디자인 개편 | 19 | 19 | T6.D → T6.0 → 6개 동시 → T6.7 → T6.8~T6.17 |
| 합계 | 55 | 43 | |

## 변경 이력
| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-11-23 | 최초 작성 (prd.md v0.3 기준) |
| v0.2 | 2026-11-23 | Codex 검토 R1(`reviews/task_review_r1.md`)과 판정(`reviews/task_review_r1_verdict.md`) 반영. 반영 항목: H-01, H-02, M-01, M-02, M-03, M-04, M-05, M-06, M-07, M-08, M-09, M-10, A-1, A-2. 사용자 결정 반영: M-10 저장소 공개 범위, A-1 네이버 지도 기본, M-09 실기기 범위(iOS 사파리 미검증). 상세는 `reviews/task_fix_r1.md` |
| v0.3 | 2026-11-23 | Codex 검토 R2(`reviews/task_review_r2.md`)와 판정(`reviews/task_review_r2_verdict.md`) 반영. 반영 항목: H-01(배포 게이트 Phase 0~4 순서, 완료 조건 [배포 전]/[배포 후] 분리), R2-M-01(smoke SW 항목 Phase 3 이후로 한정), R2-M-02(T4.2 검수 반영 대상 확대), R2-M-03(T2.0 placeholder 소유). T0.1a GitHub Pages 활성화 추가(coordinator가 gh api로 수행, 실패 시에만 [사용자]). 사용자 결정 반영: 저장소 PUBLIC 전환(T0.1, 첫 push 직전, `git ls-files` 개인 자료 0건 선행). 상세는 `reviews/task_fix_r2.md` |
| v0.4 | 2026-11-23 | T1.5 `unsupported`는 `showStaff`만(T0.2 R1 판정). 사용자 요청으로 Phase 2.5 T2.7 Remotion 시연 영상 추가 (Codex 교차 검증 대상). 이어서 v0.4 검토(`reviews/task_review_v04.md`)·판정(`reviews/task_review_v04_verdict.md`) 반영: M-01(Phase 2.5 앱 배포 게이트 제외), M-02(Playwright 녹화 클립·녹화 커밋 기록·재녹화), L-01(상단 버전 v0.4, 진행 표 Phase 0 완료 3), A-1(영상 상호 표기·소재 재사용 금지·`video/` 공개 범위). 사용자 결정 U-1(preview 녹화), U-2(`video/` 소스만 공개), U-3(Kokoro·edge-tts 내레이션, edge-tts 조건 [사용자] 확인). 상세는 `reviews/task_fix_v04.md` |
| v0.5 | 2026-11-23 | Phase 1 판정 후속 반영: T1.2 R1(S13 한국어 고정·operatorKo), T1.5 R1~R3(requesting 15초, T2.0 ListenButton TTS 계약, T4.3 실측 시나리오), T1.6 R1·R2(effectiveTakeout, ScreenKey 매핑, 리포트 ssd·500건·reports 기준), T1.1 R1(확인 전 표시, T1.1b 신설), T1.3 R1(T4.2 수량 칩). 교차 검증 `reviews/docs_review_phase1.md`, 판정 `reviews/docs_review_phase1_verdict.md` |
| v0.6 | 2026-11-23 | Phase 1·2 진행 중 판정 반영(T2.0~T2.6 화면 계약, T4.3 실측 ⑥⑦ 추가), T3.3 R1 판정: 0.3절 허용 목록·T3.3 소유에 `deck/`·`qr.svg` 추가 |
| v0.7 | 2026-11-23 | 사용자 결정(현장 확인 T4.1은 나중에): Phase 4를 4A(지금, Phase 3 배포본 대상 T4.3·T4.5·T4.2·T4.4·T4.6, T4.2 결과 도착 시 T4.2a 반영·배포)와 4B(현장 확인 후 T4.1 → T4.1a → E2E·배포·smoke → T4.7 영상 갱신 → T4.3b·T4.5b 짧은 재점검)로 분리. 0.3절 Phase 4 순서를 4A-a~d·4B-a~f로 교체, T4.3·T4.5 '같은 커밋' 기준을 4A·4B 기준 커밋으로 정리, 진행 표 4A/4B 행. 상세는 `reviews/task_fix_phase4.md` |
| v0.8 | 2026-11-23 | v0.7 검토(`reviews/task_review_v07.md`)·판정(`reviews/task_review_v07_verdict.md`) 반영. M-01: 4A 완료 정의를 '확인 전 표시 상태로 심사 시연 가능(PRD 4장 v0.6 예외)'으로 변경(사용자 결정 U-4). U-5: T4.4를 가게 안내(4B, 현장 방문 때)와 T4.4c 정정 연락처 확정(4A)으로 분리, T4.2a를 '4A 반영(번역·연락처)'으로 확장(`Settings/contact.ts` `TAKEDOWN_CONTACT`). M-02: T4.5 영상 정합성 조건. M-03: 4B-b2 E2E 데이터 기반 기대값. L-01: 진행 표(2.5 완료 1, 3 완료 1, 4B 6). 상세는 `reviews/task_fix_v08.md` |
| v0.8 보완 | 2026-11-23 | 상단 기준 문서를 prd.md v0.6으로 정정 (`reviews/task_review_v08_verdict.md` R2-L01) |
| v0.9 | 2026-11-26 | Phase 6 디자인 개편(T6.D·T6.0~T6.7) 추가. 계획 검토 R1~R3(`reviews/P6_plan_r1~r3.md`·판정) 반영. 사용자 확정 시안 C 새안(밝은 파랑 + 사진) · 파란 인트로 · e 우회로 로고. 기준 `DESIGN.md` v1.1, `PRODUCT.md`(사진 사용 결정 반영). Codex 계획 검토 R1(`reviews/P6_plan_r1.md` H2 M10 L2) 판정·반영(`reviews/P6_plan_r1_verdict.md`): T6.D 신설, 번역 패치 규칙, 사진 라이선스 필드, 코스 버튼 첫/다음 정류장, 인트로 정지 수단, 검증표 |
| v0.10 | 2026-11-26 | 문서 정합화(T6.15). 상단 기준 문서를 prd.md v0.14·DESIGN.md v1.2로 갱신(Phase 6 머리말의 DESIGN.md v1.1은 '계획 당시'로 표기). T6.D~T6.6에 커밋 39da3a4, T6.8~T6.14에 커밋 해시(e947a50·f2d4b3d·65aa9ae·c11dbc1·7643986)와 main 배포 기록 추가(git log·GitHub Actions 결과 기준). T6.13 'Next' 표시에 'T6.14에서 삭제', T6.3 버튼 규칙에 'T6.13 행선지 선택 추가', T6.9에 '나머지 2곳은 T6.10' 메모. T6.15 항목 추가(미체크). 진행 현황 표를 실제 체크박스 기준으로 다시 셈(Phase 2 8/7, Phase 3 3/3, 4A 6/2, Phase 5 행 추가 1/0, Phase 6 17/16, 합계 53/40). 완료 task의 기록 내용은 바꾸지 않음 |
