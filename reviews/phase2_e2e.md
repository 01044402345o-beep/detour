# Phase 2 E2E 결과 (Playwright)

- 실행: 2026-11-23 08:45 UTC · `cd app && npx playwright test` · 소요 약 1분
- 대상: `npm run build`(base `/detour/`) → `vite preview --port 4173` (playwright.config.ts의 webServer가 실행할 때마다 새로 빌드. 이미 떠 있는 서버는 없었음)
- 브라우저: 설치된 Microsoft Edge 158 (`channel: 'msedge'`, Playwright 브라우저는 내려받지 않음)
- 빌드 시점 소스: 작업 트리 그대로(T2.2·T2.3은 Codex 마지막 확인 중이던 상태). 두 화면의 소스가 더 바뀌면 다시 실행해야 함

## 결과: 69 통과 / 0 실패 / 0 건너뜀 / 0 flaky

| 프로젝트 | 뷰포트 | 범위 | 테스트 | 결과 |
|---|---|---|---|---|
| m390 | 390×844 (모바일, 터치) | 시나리오 1~7 × en·ja·zh (시나리오 3은 실패 4종 × 3개 언어) | 30 | 30 통과 |
| m360 | 360×780 | 시나리오 1~7 × 3개 언어 | 30 | 30 통과 |
| m430 | 430×932 | 시나리오 1·5만 × 3개 언어 | 6 | 6 통과 |
| desktop | 1280×800 | `/report`만 × 3개 언어 | 3 | 3 통과 |

- 모든 테스트에서 잡히지 않은 페이지 예외(pageerror) 0건, 콘솔 error 0건.
- 360×780은 0.1절 문구가 "시나리오 1·5만"이 430에만 걸리는지 둘 다에 걸리는지 모호해, 넓게 잡아 전 시나리오를 돌렸습니다.

## 시나리오별 확인 내용

| # | 확인한 것 | 결과 |
|---|---|---|
| 1 | 언어 선택(`/lang` 리다이렉트) → 홈 → 원도심 → 성심당 → 튀김소보로 2·판타롱부추빵 1 → 내 주문 문장이 `튀김소보로 두 개, 판타롱부추빵 한 개 주세요.`(T1.3 검수표), 발음 EN·ZH `du gae`·`han gae` / JA `トゥ ゲ`·`ハン ゲ`, 줄별 수량, 가로 스크롤 없음 | 통과 |
| 2 | 연습(음성 처리 안내 표시) → STT 목 성공(주문 문장 그대로) → 결과 점수 `100`·"잘했어요" 제목 → 직원에게 보여주기(한국어 안내 "주문입니다") → "품절이에요" → 손님 언어 품절 제목 → 주문 수정 → 장소 메뉴 탭 선택·수량 2 유지 | 통과 |
| 3 | 미지원(마이크 비활성, 재시도 없음) / 권한 거부(`not-allowed`) / 무음(`no-speech`) / 타임아웃(listening 8초 무응답) 각각: `data-stt` 상태, 실패 제목·본문(사용자 언어), 재시도 버튼 유무 → 직원에게 보여주기 → "네" → 손님 언어 "Yes" 제목 | 12×2 통과 |
| 4 | 광천식당: 오징어두루치기 "가격 확인 필요" → 담기 → 주문 바·내 주문 합계가 "총액 확인 필요"(사용자 언어), 문장 `오징어두루치기 1인분 주세요.`, 포장/매장 라디오 없음·매장 고정 표시 | 통과 |
| 5 | (en→ja, ja→zh, zh→en) 직원 화면 확인 → 설정(탭바)에서 언어 변경 → 설정 제목·탭바·개인정보 문구 즉시 전환 → 다시 직원 화면: 한국어 안내·"직원분 응답"·응답 버튼 4개 한국어 그대로, 버튼 아래 작은 문구만 새 언어 → 새로고침 후 언어 유지 → 운영자 리포트 `lang="ko"`·제목 "운영자 리포트 — 원도심"·예시 데이터 표기, 사용자 언어 문구 섞이지 않음 | 통과 |
| 6 | 리포트 내 기기 "정보 제보 0건" → 성심당 "정보가 달라요" 시트(장소명·"현장 확인 전" 표시) → 가격 제보 → 감사 토스트 → 리포트 "정보 제보 1건", 새로고침 후 유지. 덤: 실제 브라우저에서 시트 안 Tab 8회·Shift+Tab 순환 시 포커스가 시트 밖으로 안 나감(T2.0 '남은 것' 확인) | 통과 |
| 7 | 성심당 튀김소보로 1 + 포장 → `튀김소보로 한 개 주세요. 포장해 주세요.` → 광천식당 두부두루치기 담기 → 전환 확인 시트 → 비우고 담기 → `두부두루치기 1인분 주세요.`(포장 문구 없음), 매장 고정, 직원 화면에도 포장 줄 없음 | 통과 |
| D | 데스크톱: 홈은 430px 폭 이하, `/report`는 430px보다 넓고 한국어, KPI·내 기기 영역 표시, 가로 스크롤 없음 | 통과 |

## 음성 목 (`app/e2e/speechMock.ts`)

`page.addInitScript`로 `speechSynthesis`·`SpeechSynthesisUtterance`·`SpeechRecognition`/`webkitSpeechRecognition`을 바꿉니다. 앱 계약(`src/speech/stt.ts`·`tts.ts`)에 맞춘 이벤트 순서:
- 성공: `onstart` → `onspeechend` → `onresult({results:[[{transcript}]]})` → `onend`
- 권한 거부: `onerror({error:'not-allowed'})` → `onend` / 무음: `onstart` → `onerror({error:'no-speech'})` → `onend`
- 타임아웃: `onstart`만 → 앱의 listening 8초 기한 / 미지원: 두 생성자를 `undefined`로
- TTS: ko-KR 음성 1개, `speak()` 50ms 뒤 `onend`

실제 음성 경로는 T4.3 범위입니다(자동 E2E는 목 기반).

## 실행 중 고친 것 (모두 테스트 쪽, 앱 소스 변경 없음)

1. 시나리오 7 기대값을 `튀김소보로 한 개 포장해 주세요.`로 잘못 적었음 → T1.3/PRD F-06 규칙(`… 주세요.` + ` 포장해 주세요.`, `orderSentence.test.ts`와 같음)대로 `튀김소보로 한 개 주세요. 포장해 주세요.`로 수정. 앱 결함 아님.
2. 장소 이동 도우미가 탭바 없는 화면(내 주문)에서 탭바를 기다리다 시간 초과 → 탭바가 없으면 `#/course`로 이동하도록 수정. 앱 결함 아님(탭바는 라우트 표상 탭 화면에만 있는 게 맞음).

## 앱 결함(원인 task로 돌려보낼 실패)

없음.

## 파일

- `app/playwright.config.ts` — Edge channel, 프로젝트 4개(m390·m360·m430·desktop), list + JSON 리포터(`app/test-results/phase2-e2e.json`)
- `app/e2e/support.ts` — 사전(`src/i18n/*.json`) 기반 `tr()`, 한국어 고정 기대값, pageerror 0건 검사 fixture, 이동 도우미
- `app/e2e/speechMock.ts`, `s1-order-sentence`·`s2-practice-success`·`s3-practice-failures`·`s4-gwc-total-tbd`·`s5-lang-switch`·`s6-report-count`·`s7-takeout-switch`·`report-desktop` `.spec.ts`
- 재실행: `cd app && npx playwright test` (특정 뷰포트만: `--project=m390`)
