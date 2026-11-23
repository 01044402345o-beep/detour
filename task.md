# 대전 디투어 데모 — task.md

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.3 (2026-11-23) · 변경 내용은 맨 끝 '변경 이력' 참고 |
| 기준 문서 | `prd.md` v0.3 (Codex 교차 검증 미해결 0건), `mockup/index.html` |
| 저장소 | https://github.com/01044402345o-beep/detour |
| 배포 URL | https://01044402345o-beep.github.io/detour/ |

## 0. 이 문서 쓰는 법

- **체크박스가 사용자와 작업자 사이의 의사소통 수단입니다.** task가 끝나면 `- [ ]`를 `- [x]`로 바꾸고 끝에 완료일과 검토 결과 파일을 적습니다.
  예: `- [x] T1.3 주문 문장 생성 모듈 — 2026-11-25 · reviews/T1.3_r2.md (미해결 0)`
- **완료(체크) 조건:** ① 아래 "완료 조건"을 모두 충족하고, ② 9.2절 검토 루프가 미해결 0건으로 끝난 상태. 둘 중 하나라도 아니면 체크하지 않습니다. 완료 조건이 [배포 전]/[배포 후]로 나뉜 task는 [배포 후] 조건까지 충족한 뒤(0.3절 배포 게이트) 체크합니다.
- 진행 중인 task는 제목 끝에 `(진행 중 · 담당 worker)`를 붙이고, 막힌 task는 `(보류: 사유)`를 붙입니다.
- 사용자가 직접 해야 하는 task에는 **[사용자]** 표시가 있습니다.
- **PRD 우선:** `prd.md`와 목업(`mockup/index.html`)이 충돌하면 PRD를 따릅니다. 목업은 디자인(값·간격·색) 기준입니다.

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
- **이용 기록:** 각 화면 task는 자기 화면의 `screen_view`·`place_view` 등 이벤트를 store 액션으로 기록합니다.
- **제보 시트:** `ui/ReportSheet`는 T2.6 소유(T2.0 `ui/` 소유의 예외)이고, T2.3은 import만 합니다.
- **E2E 파일:** Playwright 테스트는 `app/e2e/`에 두고, phase E2E는 coordinator가 작성·실행합니다.

### 0.3 Git·배포 규칙
- 저장소 루트 = 이 폴더(`29_로컬`). `.gitignore`를 **허용 목록 방식**으로 써서 `app/`, `prd.md`, `task.md`, `mockup/`, `reviews/`, `.github/`, `.gitignore`, `README.md`만 올립니다. (HWP·영상·신청서 등 개인 자료는 올리지 않음)
- 허용 목록 아래에 빌드 산출물을 명시 제외합니다: `**/node_modules/`, `**/dist/`, `**/coverage/`, `**/test-results/`, `**/playwright-report/`, `**/.env*`.
- 브랜치: `main`(배포) / `dev`(작업). task는 `dev`에 커밋합니다. 커밋 메시지는 `T1.3: 주문 문장 생성 모듈` 형식.
- 커밋은 coordinator 한 명이 task 소유 파일만 `git add <경로>`로 stage해 수행합니다. task 체크 시 `dev`에 push합니다.
- **배포 게이트 (phase 끝).** 원칙: 배포가 없어도 확인할 수 있는 것은 모두 배포 전 로컬 `vite preview`(base `/detour/`)에서 검증합니다. 배포 후 smoke에는 실제 Pages 환경에서만 확인할 수 있는 것만 남깁니다. task 체크는 [배포 전] 조건 기준이고, [배포 후] 조건이 있는 task만 smoke 뒤에 체크합니다.
- **공통 (모든 phase)**
  1. [배포 전] phase의 모든 task가 [배포 전] 완료 조건을 충족하고 검토 미해결 0건입니다. [배포 후] 조건이 없는 task는 이 시점에 체크합니다.
  2. [배포 전] coordinator가 `dev`의 후보 커밋 해시를 고정해 기록합니다.
  3. [배포 전] `npm run build`(base `/detour/`) 후 `vite preview`에서 phase E2E를 실행합니다. 실패하면 원인 task로 돌아가 1부터 다시 시작합니다.
  4. [배포] 같은 커밋을 `main`에 병합·push → GitHub Actions가 Pages에 배포합니다.
  5. [배포 후] 배포 URL smoke(모든 phase): HTTPS 200, 콘솔 오류 0건, 자산이 `/detour/` 경로로 로드됨.
     smoke 추가(Phase 3 이후): service worker 등록(scope `/detour/`), 배포 URL에서 "오프라인 준비 완료" → 오프라인 새로고침.
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
- **Phase 3 (PWA 후보)**
  - 3-a. [배포 전] T3.1 구현. [배포 전] 완료 조건: preview에서 ① "오프라인 준비 완료" 표시 → 네트워크 차단 → 새로고침 → 미방문 화면 열림, ② 업데이트 토스트 확인(빌드 A preview 접속 → 빌드 B로 다시 build·preview → 새로고침 시 토스트 → 새 버전 적용). 배포가 필요 없으므로 T3.1은 이 시점에 체크합니다.
  - 3-b. [배포 전] T3.3 QR 생성(배포 URL은 고정값)과 슬라이드 삽입. T3.1과 병렬. [배포 후] 조건(스캔)이 남으므로 아직 체크하지 않습니다.
  - 3-c. [배포 전] 빌드 고정 → T3.2 측정(preview에서 Fast 4G·캐시 없음 측정, 번들 리포트) → T3.2 체크.
  - 3-d. 공통 3: preview에서 Phase 2 시나리오 + 오프라인 시나리오 실행.
  - 3-e. 공통 4~6 (smoke에 Phase 3 이후 항목 포함).
  - 3-f. [배포 후] T3.3 [배포 후] 조건: 슬라이드 화면의 QR을 실제 휴대폰으로 스캔 → 앱 열림 → T3.3 체크.
- **Phase 4 (최종 콘텐츠, 0.1절 'phase 단위 검증'보다 우선)**
  - 4-a. [배포 전] T4.1·T4.2·T4.4 결과 수령 → 사용자 task 체크.
  - 4-b. [배포 전] T4.1a 반영과 검토 루프. 미해결 0건이면 체크.
  - 4-c. 공통 2~6 (Phase 4 E2E = preview에서 Phase 2·3 시나리오 재실행 → 배포 → smoke, Phase 3 이후 항목 포함).
  - 4-d. [배포 후] T4.3: 4-c에서 배포한 커밋 해시를 기록하고 실기기 점검 → 체크.
  - 4-e. [배포 후] T4.5: 같은 커밋 대상 리허설 → 체크. 리허설에서 수정이 생기면 4-b로 돌아갑니다.
- **확인 기준:** 어떤 [배포 전] 단계도 아직 수행하지 않은 배포의 결과를 요구하지 않습니다(0-c·3-a·3-b·4-b는 로컬·CI 결과만 요구).

---

## Phase 0 — 기반 준비 (순차)

- [x] **T0.1 저장소 초기화** — 소유: `.gitignore`, `README.md`, `.github/` — 2026-11-23 · reviews/T0.1_r2.md (미해결 0) · PUBLIC 전환·push 완료
  - git init, 허용 목록 `.gitignore`(0.3절 제외 목록 포함), 원격 `origin` 연결, `main`/`dev` 브랜치 생성
  - 현재 저장소 `01044402345o-beep/detour`는 PRIVATE·빈 저장소. 무료 GitHub Pages를 쓰기 위해 **첫 push 직전**에 coordinator가 `gh repo edit 01044402345o-beep/detour --visibility public --accept-visibility-change-consequences`로 PUBLIC 전환
  - 공개 전환의 선행 조건: `git ls-files` 목록 검사에서 허용 경로만 있고 개인 자료(HWP, mp4, 신청서 PDF 등) 0건
  - README: 프로젝트 한 줄 소개, 실행 방법, 문서 링크(prd/task/mockup)
  - 완료 조건: 첫 커밋 전 `git ls-files` 전체 목록을 `reviews/T0.1_files.txt`에 남기고, 허용 경로만 있음(개인 자료 0건). 그 뒤 저장소 PUBLIC 전환 확인(`gh repo view --json visibility`가 `PUBLIC`). 원격 push 성공.
- [x] **T0.1a GitHub Pages 활성화** — 담당: coordinator (실패 시에만 **[사용자]**). T0.1의 공개 전환 후 수행 — 2026-11-23 · build_type=workflow 확인
  - coordinator가 `gh api -X POST repos/01044402345o-beep/detour/pages -f build_type=workflow`로 Pages 소스를 'GitHub Actions'로 설정합니다
  - `gh`로 안 되면 이 task를 **[사용자]**로 바꾸고, 사용자가 저장소 Settings → Pages → Source를 'GitHub Actions'로 설정합니다
  - 완료 조건: `gh api repos/01044402345o-beep/detour/pages`의 `build_type`이 `workflow`
- [x] **T0.2 앱 골격** — 소유: `app/` 전체 (이 시점에만) — 2026-11-23 · reviews/T0.2_r2.md (미해결 0)
  - `app/`에 Vite + React + TypeScript 생성. 의존성: react-router-dom, zustand, leaflet, vite-plugin-pwa, vitest, @testing-library/react, @playwright/test, eslint, prettier
  - 스타일: **CSS Modules + 전역 토큰 `app/src/styles/tokens.css`** (목업의 색·글꼴·반경 값을 그대로 옮김). Tailwind는 쓰지 않음
  - `vite.config.ts`의 `base: '/detour/'`, HashRouter
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
- [ ] **T0.3 CI·배포 골격** — 소유: `.github/workflows/`
  - PR/push 시 lint·type·unit test 실행, `main` push 시 build → GitHub Pages 배포
  - 완료 조건 [배포 전]: workflow 파일의 lint·type·test·build 단계가 `dev` push에서 성공
  - 완료 조건 [배포 후]: `main`에 빈 앱이 배포되어 배포 URL에서 열림 (HTTPS) → smoke 뒤 체크 (0.3절 0-f)

**Phase 0 E2E:** 0.3절 배포 게이트 Phase 0(0-a~0-f)을 따릅니다. 공통 3은 'build 성공'으로 대신하고, smoke는 배포 URL 200 응답·콘솔 오류 0건입니다.

---

## Phase 1 — 데이터·도메인 로직 (병렬 묶음 A: 6개 동시)

> 화면 없이 순수 로직과 데이터만 만듭니다. 모두 단위 테스트로 검증합니다. 서로의 모듈은 T0.2 공유 계약(타입·시그니처)만 의존하고, 구현이 필요하면 fixture로 테스트합니다.

- [ ] **T1.1 원도심 콘텐츠 데이터** — 소유: `app/src/data/`
  - `downtown.json`: 코스 1개, 장소 4곳(PRD 4장), 메뉴 8개, 문장 14개, 단계 안내, 좌표, 확인일
  - 현장 미확인 값은 `verified:false`, 가격 미확인은 `priceKrw` 생략, 알레르기 미확인은 `allergenStatus:'unknown'`
  - 광천식당 주소(선화동)·사리 명칭은 데이터 안 `note` 필드에 "확인 필요" 표기
  - 장소별 문장의 `words`(단어 칩)와 3개 언어 뜻, 로마자·가타카나
  - `validate.ts`: 타입·필수 필드·L10n 3개 언어 누락·좌표 범위 검사
  - 완료 조건: 검증 테스트 통과(누락 0), 목업 데이터와 내용 일치
- [ ] **T1.2 다국어 사전** — 소유: `app/src/i18n/`
  - `en.json`·`ja.json`·`zh.json`: 목업의 UI 문구 전체 + PRD에 정한 고지 문구(비제휴 안내, 음성 처리 안내, 가격 확인 필요, 총액 확인 필요, 인식 실패 메시지 등)
  - **PRD 우선:** PRD와 목업이 충돌하면 PRD를 따릅니다. 목업 `privacy` 키는 '이용 기록은 이 기기에만 저장됩니다(음성은 저장하지 않음)' 취지로 교체합니다(PRD F-08·7장)
  - `t(lang, key)`는 순수 함수, `useT()`는 store의 `lang` 계약만 import. 키 누락 시 개발 모드 경고
  - 하드코딩 검사 예외 목록: 한국어 콘텐츠 JSON(학습 문장·메뉴명), 직원 화면 고정 문구(한국어 안내·응답 버튼), 상호명
  - 완료 조건: 세 파일의 키 집합이 같음(테스트), 빈 문자열·영어 fallback 없음(ja·zh), 예외 목록 밖 하드코딩 문구 없음(린트 규칙 또는 검사 스크립트)
- [ ] **T1.3 주문 문장 생성 + 수사 검수표** — 소유: `app/src/domain/orderSentence.ts`, `numerals.ts`
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
- [ ] **T1.4 채점 모듈** — 소유: `app/src/domain/scoring.ts`
  - 정규화: 공백·문장부호 제거, 숫자 → 한글 수사(뒤따르는 단위 기준: 개·공기·명 → 고유어, 인분 → 한자어. `numerals.ts` 시그니처만 의존하고 fixture로 테스트), 소문자화
  - 한글 음절 → 자모 분해, 레벤슈타인 거리 → "인식 일치도" 점수 = `round(100 × (1 − 거리 / max(목표 자모 수, 인식 자모 수)))`, 하한 0
  - 단어별 일치 여부(목표 단어 기준 정렬), 가장 약한 단어 1개 반환. 출력은 T0.2의 `ScoreResult` 타입
  - 빈 인식 결과 → `{ status:'empty' }` (0점 아님)
  - 완료 조건: 기대값 예시(완전 일치 → 100, '두 개'↔'2개' → 100, 빈 결과 → `empty`) 포함, 한 글자 틀림·띄어쓰기 차이·숫자 표기 차이·빈 입력 테스트 통과
- [ ] **T1.5 음성 어댑터** — 소유: `app/src/speech/`
  - `tts.ts`: `speak(text, rate)`, 한국어 음성 찾기(`voiceschanged` 대기, 최대 2초), 사용자 탭에서만 시작, 화면 이탈 시 `cancel()`, 상태 `unsupported | no-korean-voice | ready`
  - `stt.ts` 상태 머신 (PRD F-08):
    ```
    idle → requesting(권한) → listening → processing → result
                    ↘ denied      ↘ no-speech / timeout(8초) / network / aborted / error
    unsupported (API 없음)
    ```
    모든 실패 상태는 `{ retry, showStaff }` 두 선택지를 UI에 넘김(단, `unsupported`는 재시도가 의미 없으므로 `showStaff`만 — T0.2 R1 판정). 인식 원문은 결과로만 반환하고 저장·로그하지 않음
  - 테스트: Web Speech API 목(mock)으로 상태 전이 전부 검증
  - 완료 조건: 상태 전이 테스트 통과, 타임아웃 8초 테스트(가짜 타이머)
- [ ] **T1.6 앱 상태·이용 기록** — 소유: `app/src/store/`, `app/src/domain/events.ts`
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
- [ ] **T2.0 공용 컴포넌트·레이아웃** — 소유: `app/src/ui/`(`ui/ReportSheet`, `ui/map/` 제외), `app/src/styles/`, `app/src/App.tsx`, 라우터, `screens/*/index.tsx` placeholder(최초 생성만)
  - T2.0 체크 시점에 각 placeholder의 소유는 해당 화면 task로 넘어갑니다
  - Button, Pill, Card, IconButton, TopBar, TabBar, Sheet(바텀시트), Toast, 아이콘 세트(SVG)
  - `ui/ListenButton`: 공용 듣기 버튼. TTS `no-korean-voice`·`unsupported` 안내 UI 담당 (F-07)
  - `ui/Pronunciation`: 발음 표기 공용 표시. EN·ZH는 로마자, JA는 가타카나 (F-01)
  - 라우트 표: `/lang` `/` `/course` `/place/:id` `/order` `/practice` `/result` `/staff` `/reply` `/phrases` `/saved` `/settings` `/report`. 각 라우트는 `screens/<이름>/index.tsx`를 lazy import(빈 화면 placeholder)
  - 연습·직원 화면 입력 상태 계약: `{ src: 'order'|'phrase', phraseId? }`
  - 첫 실행(언어 미선택) → `/lang` 리다이렉트
  - 데스크톱에서 폰 폭(430px) 가운데 정렬, `/report`만 예외
  - 완료 조건: 모든 라우트가 빈 화면으로 열림, 터치 영역 44px 이상, 대비 4.5:1 검사 통과

### 2-2 화면 (병렬 묶음 B: 6개 동시, T2.0 완료 후)
- [ ] **T2.1 언어 선택·홈·설정 (S00·S01·S12)** — 소유: `screens/Lang*`, `screens/Home*`, `screens/Settings*`
  - 언어 즉시 전환, 잠긴 거점·1박 배너는 "Coming soon" 토스트, 오늘의 코스(F-02), 오늘의 문장 듣기, 설정 → 운영자 리포트 진입, 데모 데이터 초기화
  - 설정 하단에 정정·삭제 연락처 표시 자리(PRD 10장). 값은 T4.4에서 확정해 T4.1a에서 반영
- [ ] **T2.2 코스 지도 (S02)** — 소유: `screens/Course*`, `ui/map/`
  - Leaflet + OSM 타일, OSM 출처 표시 상시 노출, 번호 핀 4개 + 정류장 연결선(보행 경로 아님 표기)
  - 타일 로드 실패·오프라인 → SVG 약도로 자동 전환
  - 정류장 목록에 이동 시간·확인일 표시, 핀·목록 클릭 → 장소 상세 (F-03)
  - "Start walking" → 다음 정류장의 **네이버 지도 웹 길찾기 URL**(기본) 열기. Google Maps는 장소 보기용 보조 링크
- [ ] **T2.3 장소 상세·메뉴 담기·내 주문 (S03·S04·S05)** — 소유: `screens/Place*`, `screens/Order*`
  - 탭(메뉴/이용 방법/문장), `orderable:false`면 메뉴 탭 없이 이용 방법 탭으로 열림, 확인일 배지, 영업 상태(Asia/Seoul 기준 참고값), 알레르기(미확인은 "확인 필요"), 비제휴 안내 문구
  - 길찾기 버튼: 네이버 지도 웹 길찾기(기본), Google Maps 장소 보기(보조) (F-04)
  - 장소 북마크 추가·해제, 새로고침 후 유지 (F-13)
  - "정보가 달라요" → `ui/ReportSheet`(T2.6) import
  - +/− 수량(1~9), 1에서 −를 누르면 항목 삭제, 주문 바(수량, 모든 가격 확인 시 합계 예시가), 가격 미확인 → "가격 확인 필요"·"총액 확인 필요" (F-05)
  - 다른 장소에서 담으려 하면 기존 주문 비울지 확인 시트
  - 내 주문: 주문 카드(문장·발음·번역), 포장/매장(`takeout:false`면 숨기고 매장 고정), 빈 주문이면 버튼 비활성
- [ ] **T2.4 말하기 연습·채점 결과 (S06·S07)** — 소유: `screens/Practice*`, `screens/Result*`
  - 마이크 켜기 전 음성 처리 안내(3개 언어), STT 상태 머신 UI 연결, 실패 시 재시도/직원에게 보여주기
  - 단어 칩 TTS, 0.75배속, 진행률, 결과 화면 "인식 일치도" 점수·약한 단어·팁
  - 단어별 일치 여부를 색으로 표시, 팁은 사용자 언어 (F-09)
- [ ] **T2.5 직원에게 보여주기·직원 응답 (S08·S09)** — 소유: `screens/Staff*`, `screens/Reply*`
  - 전체 화면 표시, 한국어 고정 안내(주문/요청 구분), 주문 항목 목록(`src:'phrase'`면 목록 숨기고 안내는 "외국인 손님의 요청입니다") (F-10)
  - 큰 글씨 토글, 읽어주기, 응답 4종 → 손님 언어로 크게 표시, 품절 → 주문 수정
  - 화면 켜짐 유지(Wake Lock API, 미지원 시 무시)
- [ ] **T2.6 문장 모음·저장·제보·운영자 리포트 (S10·S11·S13)** — 소유: `screens/Phrases*`, `screens/Saved*`, `screens/Report*`, `ui/ReportSheet`
  - 문장 모음(듣기·연습), 문장 북마크 추가·해제(새로고침 후 유지), 저장 목록, 제보 시트(4종) → 이벤트 기록
  - 운영자 리포트: 지표 4종(추가 방문 비율·성심당 다음 방문지 분포·많이 쓴 문장·제보 현황), 예시 데이터 + "예시 데이터" 표기, 내 기기 기록은 따로 표시하고 합산하지 않음(F-16a), 휴대폰에서는 1열

**Phase 2 E2E (Playwright, 0.1절 뷰포트, 3개 언어 각각, `vite preview` 대상):**
1. 언어 선택 → 홈 → 원도심 → 성심당 → 튀김소보로 2·판타롱부추빵 1 담기 → 내 주문 문장이 검수표 기대값과 일치
2. 연습 → (STT 목) 성공 → 결과 화면 점수 표시 → 직원에게 보여주기 → "품절이에요" → 손님 언어 표시 → 주문 수정
3. (STT 목) 미지원/권한 거부/무음/타임아웃 → 직원에게 보여주기 → 응답 "네" → 손님 언어 표시까지 완주
4. 광천식당: 포장 토글 숨김, 오징어두루치기(가격 미확인) 담기 → "총액 확인 필요"
5. 설정 → 언어 변경 → UI 문구 전환 + 한국어 고정 영역 유지(하드코딩 검사 예외 목록 기준) → 운영자 리포트 진입
6. 제보 → 리포트의 내 기기 제보 건수 +1
7. 성심당 포장 선택 → 광천식당으로 전환 → 문장에 "포장해 주세요" 없음

---

## Phase 2.5 — 시연 영상 (Remotion · 사용자 요청 2026-11-23)

> Phase 2 E2E 통과 후 시작합니다. 앱 코드(`app/`)를 바꾸지 않으므로 **Phase 3과 병렬로 진행**합니다. Phase 4에서 콘텐츠가 바뀌면 다시 렌더링합니다(T2.7 재실행).

- [ ] **T2.7 Remotion 시연 영상** — 소유: `video/` 전체(렌더 결과 `video/out/`은 git 제외)
  - 준비: Remotion 에이전트 스킬 설치, `video/`에 Remotion 프로젝트 생성. Remotion 라이선스 조건(개인·소규모 무료 여부)을 확인해 `reviews/T2.7_license.md`에 기록
  - 장면 구성(약 90초, 폰 프레임 390×844 + 자막): 문제 제기(빵집 한 곳 집중) → 언어 선택 → 원도심 코스 → 성심당 메뉴 담기 → 한국어 주문 카드 → 듣고 따라 말하기·인식 일치도 → 직원에게 보여주기·직원 응답 → 광천식당(매장 식사) → 운영자 리포트("빵집 다음은 어디였나") → 마무리(QR·배포 URL)
  - 앱 화면은 `app/src/` 컴포넌트를 읽기 전용으로 import하거나 Playwright 녹화본을 넣습니다. 앱 쪽 수정이 필요하면 coordinator에 요청합니다
  - 음성 인식 장면은 재현 장면임을 화면에 작게 표시합니다(실제 인식 화면은 T4.3 기기 녹화로 교체 가능)
  - 자막 언어: 한국어 기본 + 영어 버전(일본어·중국어는 선택)
  - 내레이션: 기존 홍보영상(`daejeon-detour-film/`)의 음성 제작 방식을 참고하되 새로 만듭니다. 기존 파일은 수정하지 않습니다
  - 완료 조건: `npx remotion render`로 1080×1920(세로) mp4 생성, 길이 120초 이하, 자막·화면 문구가 PRD(비제휴 안내, 인식 일치도 용어, 예시 데이터 표기)와 일치, 렌더 결과 경로와 길이를 `reviews/T2.7_render.md`에 기록, 검토 미해결 0건
  - Git: `.gitignore` 허용 목록에 `video/`를 추가하고 `video/out/`, `video/node_modules/`는 제외 (coordinator)

---

## Phase 3 — 오프라인·성능·배포 (순차: T3.1 → 빌드 고정 → T3.2, T3.3은 병렬. 순서는 0.3절 3-a~3-f)

- [ ] **T3.1 PWA·오프라인** — 소유: `app/public/manifest.webmanifest`, `app/src/sw/`, `vite.config.ts`, `screens/Settings*`의 오프라인 표시 부분, `ui/Toast` 연결, `package.json`·lock(플러그인 추가 시)
  - manifest(start_url·scope `/detour/`, 아이콘), service worker 프리캐시: 앱 셸 + 3개 언어 사전 + 원도심 JSON + SVG 약도. OSM 타일은 프리캐시 제외
  - "오프라인 준비 완료" 조건: 프리캐시 목록 전부 캐시됨 → 설정 화면에 표시
  - 새 버전 배포 시 캐시 갱신(업데이트 토스트)
  - 완료 조건 [배포 전]: preview에서 ① "오프라인 준비 완료" 표시 → 네트워크 차단 → 새로고침 → 미방문 화면 포함 전 화면 열림, ② 업데이트 토스트 확인(빌드 A preview 접속 → 빌드 B로 다시 build·preview → 새로고침 시 토스트 → 새 버전 적용, 수동 확인). [배포 후] 조건 없음 → 이 시점에 체크
- [ ] **T3.2 성능·접근성 점검** — T3.1 후 고정한 빌드를 측정. 수정이 필요하면 coordinator가 해당 파일 담당 task로 되돌림
  - 첫 로드 JS gzip 200KB 이하(빌드 리포트), Fast 4G·캐시 없음 기준 첫 화면 3초 이내, Lighthouse 접근성 90 이상
  - axe 검사(대비) + 모든 버튼 44px 자동 검사 스크립트를 Lighthouse와 함께 실행
  - 완료 조건: 측정 결과를 `reviews/T3.2_metrics.md`에 기록, 기준 미달 0
- [ ] **T3.3 배포·QR** (병렬) — 소유: `.github/workflows/`, `app/public/qr.png`
  - 배포 URL QR 이미지 생성(시연 자료용 PNG·SVG). 배포 URL은 고정값이므로 배포 전에 만듦
  - 완료 조건 [배포 전]: QR 이미지 생성, 시연 자료(발표 슬라이드)에 QR 삽입
  - 완료 조건 [배포 후]: `main` 배포 확인, 슬라이드 화면의 QR을 실제 휴대폰으로 스캔 → 앱 열림 → smoke 뒤 체크 (0.3절 3-f)

**Phase 3 E2E:** `vite preview` 대상 Phase 2 시나리오 재실행 + 오프라인 시나리오("오프라인 준비 완료" 표시 대기 → 네트워크 차단 → 새로고침 → 미방문 장소 상세·문장 모음·약도 표시). 통과 후 0.3절 공통 4~6(smoke에 Phase 3 이후 항목 포함) → 3-f.

---

## Phase 4 — 콘텐츠 검증·시연 준비

> 순서: 0.3절 4-a~4-e를 따르며, 0.1절 'phase 단위 검증'보다 우선합니다. T4.1·T4.2·T4.4 결과 수령 → T4.1a 반영·체크 → Phase 4 E2E(preview) → 배포·smoke → T4.3·T4.5

- [ ] **T4.1 현장 확인 [사용자]** — PRD 11장: 4곳 메뉴·가격·영업시간·휴무일·주문 방식, 주소·좌표, 광천식당 사리 명칭·단독 주문 여부
- [ ] **T4.2 번역 원어민 검수 [사용자]** — 일본어·중국어 UI 문구, 문장 뜻, 가타카나 표기
- [ ] **T4.4 가게 안내 [사용자]** — 실제 상호 사용 안내·동의 여부 확인, 정정·삭제 연락처 확정
- [ ] **T4.1a 검증 결과 반영** — 담당: coordinator (검토 루프 적용)
  - T4.1 결과 → `downtown.json` 갱신(`verified:true`, `checkedAt` 갱신), 주소·좌표 확정 후 도보 시간·총거리 재계산
  - T4.2 결과 → 영향받는 곳에 모두 반영: ① `i18n/*.json`(UI 문구) ② `downtown.json`의 해당 `meaning`·`words[].meaning`·`kana` ③ 수사 표기 변경 시 task.md 검수표 + `numerals.ts`·`orderSentence.ts`와 대응 테스트 기대값. 변경 없는 파일은 건드리지 않음
  - T4.4 결과 → 정정·삭제 연락처를 T2.1의 표시 자리에 반영
  - 완료 조건 [배포 전]: 반영 완료, 교정 항목별 반영 파일을 `reviews/T4.1a_fix.md`에 기록, 검토 미해결 0건. 배포는 완료 조건이 아니며 0.3절 4-c에서 수행
- [ ] **T4.3 실기기 점검** [배포 후] — 0.3절 4-c에서 배포한 커밋 해시를 `reviews/T4.3_devices.md`에 먼저 기록
  - 확보 기기: 안드로이드 + 크롬(진행자 시연 기기) — QR 접속, TTS 한국어 음성, 마이크 권한, 인식, 오프라인, Start walking 네이버 지도 도보 경로 표시. PC 크롬/엣지 — 운영자 리포트
  - iOS 사파리는 **미검증**으로 기록. 심사위원 iPhone은 텍스트·직원 화면 완주 경로로 대응
  - 실제 사용한 기기·OS·브라우저 버전 기록
  - 실제 음성 경로 증거는 이 문서가 유일하며, 자동 E2E는 목 기반임을 명시
- [ ] **T4.5 시연 리허설** [배포 후] — T4.3과 같은 커밋(해시 기록) 대상. 리허설에서 수정이 생기면 0.3절 4-b로 돌아감
  - 합격 조건: 안내 없이 180초 이내 완주, 진행자 음성 경로와 심사위원 텍스트 경로 각 1회
  - 비상 시나리오(인식 실패 → 직원 화면) 연습
- [ ] **T4.6 심사 일정 확정 [사용자]** — 일정에 맞춰 Phase 3·4 일정 역산

---

## 진행 현황 요약

| Phase | task 수 | 완료 | 병렬 |
|---|---|---|---|
| 0 기반 | 4 | 0 | 순차 |
| 1 데이터·도메인 | 6 | 0 | 6개 동시 |
| 2 화면 | 7 | 0 | T2.0 후 6개 동시 |
| 2.5 시연 영상 | 1 | 0 | Phase 3과 병렬 |
| 3 오프라인·배포 | 3 | 0 | T3.1 → T3.2 순차, T3.3 병렬 |
| 4 검증·시연 | 7 | 0 | 사용자 task 포함 |

## 변경 이력
| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-11-23 | 최초 작성 (prd.md v0.3 기준) |
| v0.2 | 2026-11-23 | Codex 검토 R1(`reviews/task_review_r1.md`)과 판정(`reviews/task_review_r1_verdict.md`) 반영. 반영 항목: H-01, H-02, M-01, M-02, M-03, M-04, M-05, M-06, M-07, M-08, M-09, M-10, A-1, A-2. 사용자 결정 반영: M-10 저장소 공개 범위, A-1 네이버 지도 기본, M-09 실기기 범위(iOS 사파리 미검증). 상세는 `reviews/task_fix_r1.md` |
| v0.3 | 2026-11-23 | Codex 검토 R2(`reviews/task_review_r2.md`)와 판정(`reviews/task_review_r2_verdict.md`) 반영. 반영 항목: H-01(배포 게이트 Phase 0~4 순서, 완료 조건 [배포 전]/[배포 후] 분리), R2-M-01(smoke SW 항목 Phase 3 이후로 한정), R2-M-02(T4.2 검수 반영 대상 확대), R2-M-03(T2.0 placeholder 소유). T0.1a GitHub Pages 활성화 추가(coordinator가 gh api로 수행, 실패 시에만 [사용자]). 사용자 결정 반영: 저장소 PUBLIC 전환(T0.1, 첫 push 직전, `git ls-files` 개인 자료 0건 선행). 상세는 `reviews/task_fix_r2.md` |
| v0.4 | 2026-11-23 | T1.5 `unsupported`는 `showStaff`만(T0.2 R1 판정). 사용자 요청으로 Phase 2.5 T2.7 Remotion 시연 영상 추가 (Codex 교차 검증 대상) |
