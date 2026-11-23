# Phase 3 E2E 결과 (Playwright)

- 실행: 2026-11-23 09:31~ UTC · `cd app && npx playwright test`
- 대상: `npm run build`(base `/detour/`) → `vite preview --port 4173` (webServer가 실행마다 새로 빌드, 기존 서버 없음 확인)
- 브라우저: 설치된 Microsoft Edge 158 (`channel: 'msedge'`), 음성은 목(`e2e/speechMock.ts`)
- 설정 변경: `use.serviceWorkers: 'allow'` 명시, JSON 리포트 `app/test-results/e2e.json`
- 앱 소스 변경 없음

## 결과 요약

| 실행 | 구성 | 결과 |
|---|---|---|
| 1회차 | 기본(4 workers) | **74 통과 / 1 실패** — `[m360] P3 오프라인 [en]`: "오프라인 준비 완료" 30초 안에 안 보임 |
| 단독 반복 | `p3-offline --repeat-each=5` (오프라인 6개 × 5) | 30 / 30 통과 |
| 2~4회차 | 기본, 전체 3회 연속 (실패 시 SW 진단 첨부 추가 후) | 75/75 × 3 = 225 통과 |
| 부하 | `--workers=8 --repeat-each=2` | 150 / 150 통과 |
| **최종(4회차 기본 실행)** | | **75 통과 / 0 실패** |

누적 480회 중 실패 1회(1회차). 그 뒤로 재현되지 않았습니다 → 아래 '간헐 실패' 참고.

| 프로젝트 | 뷰포트 | 범위 | 테스트 수 |
|---|---|---|---|
| m390 | 390×844 | Phase 2 시나리오 1~7 + 오프라인 × en·ja·zh | 33 |
| m360 | 360×780 | 같음 | 33 |
| m430 | 430×932 | 시나리오 1·5 × 3개 언어 | 6 |
| desktop | 1280×800 | `/report` × 3개 언어 | 3 |

Phase 2 시나리오(1~7, 데스크톱 리포트)는 `reviews/phase2_e2e.md`와 같은 spec을 그대로 재실행했고 모든 실행에서 통과했습니다.

## 오프라인 시나리오 (`app/e2e/p3-offline.spec.ts`, 언어마다)

1. 언어 선택 → 홈 → 설정(탭바). 온라인 방문은 lang·home·settings뿐(장소·문장·코스 미방문)
2. 설정 "오프라인 준비 완료"(`offline-ready`, 사용자 언어 `pwa.offlineReady`) 표시 대기(최대 30초) — 실제로는 1초 안팎
3. 서비스 워커 scope `/detour/`로 끝남·페이지 제어 중(controller) 확인
4. `context.setOffline(true)` → 새로고침 → 설정 화면 열림, `navigator.onLine === false`
5. 미방문 장소 4곳(`#/place/ssd|eun|mus|gwc`)을 각각 열고 **새로고침**(오프라인 문서 요청) → 장소 화면·탭·"현장 확인 전" 배지(사용자 언어)
6. 성심당에서 튀김소보로 담기 → 주문 바 표시
7. `#/phrases` 새로고침 → 문장 모음(“포장해 주세요” 표시)
8. `#/course` 새로고침 → SVG 약도(`map-sketch`) 표시, 타일 지도(`map-tiles`) 없음, 핀 4개·연결선

## 간헐 실패 1건 (앱 결함 후보, 재현 안 됨)

- **증상:** 1회차 `[m360] P3 오프라인 [en]`에서 설정 화면은 열렸지만 `offline-ready` 카드가 30초 동안 나타나지 않음. 같은 실행의 나머지 5개 오프라인 테스트는 통과. 이후 405회 실행에서 재현 0회. 1회차 trace·스크린샷은 다음 실행에서 `test-results/`가 덮어써져 남아 있지 않습니다(실패 당시엔 진단 첨부 코드가 없었음).
- **원인 task 후보:** T3.1 (`app/src/sw/pwa.ts`) — 추정이며 확인되지 않았습니다.
  - `refreshOfflineReady()`는 `onRegisteredSW`·`onOfflineReady`·`controllerchange` 세 이벤트 때만 불립니다. 워커가 아직 페이지를 제어하지 않으면 `null`(판정 보류), 프리캐시 상태 응답이 5초(`STATUS_TIMEOUT_MS`) 안에 안 오면 `null`이고, 이 경우 다시 묻는 경로(재시도·설정 화면 진입 시 재확인)가 없습니다. 그래서 세 이벤트 시점에 모두 응답을 못 받으면 그 세션에선 표시가 끝내 안 나옵니다. 4 workers 병렬 빌드 직후 부하에서 이 타이밍이 겹쳤을 가능성이 있습니다.
  - 실제 시연 영향: 표시만 안 나올 뿐, 프리캐시는 되어 있어 오프라인 동작 자체와는 무관할 가능성이 높음(다른 화면 새로고침이나 앱 재실행 때 다시 판정됨).
- **재현 절차(시도용):** `cd app && npx playwright test --project=m360 p3-offline --repeat-each=20 --workers=8`. 실패하면 첨부 `sw-diagnostic`(controller 여부, active/waiting/installing 상태, 테스트가 직접 보낸 `DETOUR_PRECACHE_STATUS` 응답, 진단 뒤 카드 표시 여부)으로 "앱이 판정을 놓친 것"인지 "프리캐시 미완료"인지 구분됩니다.
- **제안(판단은 coordinator):** T3.1에 설정 화면 진입 시 `refreshOfflineReady()` 재호출 또는 `null`일 때 짧은 재시도를 두는 것을 검토. 지금 상태로 Phase 3 게이트를 막을지는 coordinator 결정 사항입니다.

## 파일

- 추가: `app/e2e/p3-offline.spec.ts`(실패 시 SW 진단 첨부 포함)
- 수정: `app/playwright.config.ts`(`serviceWorkers: 'allow'`, 리포트 파일명 `e2e.json`)
- Phase 2 spec(`s1`~`s7`, `report-desktop`, `support.ts`, `speechMock.ts`)은 변경 없음
