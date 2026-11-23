# task.md 수정 R2 (Claude)

- 수정일: 2026-11-23. 대상: `task.md` v0.2 → v0.3.
- 입력: `reviews/task_review_r2.md`(Codex), `reviews/task_review_r2_verdict.md`(판정: 타당 4 / 부분 0 / 부당 0). 판정의 수정 지침 범위 안에서만 고쳤다.
- 수정한 파일: `task.md`, 새 파일 `reviews/task_fix_r2.md`.

## 항목별 반영 내용

| ID | 반영 위치 | 반영 내용 요약 | 미반영·비고 |
|---|---|---|---|
| H-01 | 0장 체크 조건, 0.1절 'phase 단위 검증', 0.3절 '배포 게이트', T0.3, Phase 0·1·3 E2E, T3.1, T3.3, Phase 4 머리말, T4.1a, T4.3, T4.5 | 판정 1.1의 순서를 0.3절에 그대로 옮김: 원칙, 공통 1~7, Phase 0(0-a~0-f), Phase 1·2, Phase 3(3-a~3-f), Phase 4(4-a~4-e), 확인 기준. 0.1절을 "배포 전 완료 조건 충족 + 미해결 0건이면 E2E, 배포 후 인수 조건이 있는 task는 smoke 뒤 체크"로 변경. 완료 조건을 [배포 전]/[배포 후]로 나눔: T0.3(전: `dev` push에서 workflow 성공 / 후: 배포 URL에서 빈 앱 열림), T3.1(전: preview 오프라인 + 빌드 A·B preview로 업데이트 토스트 확인, 후: 없음), T3.3(전: QR 생성·슬라이드 삽입 / 후: 배포 확인·스캔), T4.1a(배포를 완료 조건에서 빼고 4-c로 이동), T4.3·T4.5는 [배포 후] 표시. Phase 4 순서가 0.1절보다 우선함을 명시 | 0장 체크 조건에 "[배포 전]/[배포 후]로 나뉜 task는 [배포 후]까지 충족 후 체크" 한 줄을 정합용으로 추가 |
| R2-M-01 | 0.3절 공통 5, Phase 1·2, Phase 1 E2E | smoke를 "모든 phase: HTTPS 200·콘솔 오류 0·`/detour/` 자산 로드"와 "Phase 3 이후: SW 등록(scope `/detour/`)·오프라인 새로고침" 두 줄로 나눔. Phase 1은 공통 3을 "실제 모듈 연결 단위 테스트 + 타입 검사 + build 성공"으로 대신 | — |
| R2-M-02 | T4.1a | T4.2 결과를 ① `i18n/*.json` ② `downtown.json`의 `meaning`·`words[].meaning`·`kana` ③ 수사 표기 변경 시 검수표 + `numerals.ts`·`orderSentence.ts`·테스트 기대값에 반영, 변경 없는 파일은 건드리지 않음. 완료 조건에 "교정 항목별 반영 파일을 `reviews/T4.1a_fix.md`에 기록" 추가 | — |
| R2-M-03 | T2.0 | 소유에 "`screens/*/index.tsx` placeholder(최초 생성만)" 추가, "T2.0 체크 시점에 placeholder 소유는 해당 화면 task로 넘어감" 명시 | — |

## 기타

| 대상 | 내용 |
|---|---|
| 저장소 공개 전환 (사용자 결정) | coordinator가 전달한 사실: 저장소는 현재 PRIVATE·빈 저장소, gh는 해당 계정으로 로그인(repo 권한). 결정: 무료 Pages를 위해 PUBLIC 전환. T0.1에 "첫 push 직전 coordinator가 `gh repo edit --visibility public`로 전환, 선행 조건은 `git ls-files` 검사 개인 자료 0건"을 넣고, 완료 조건에 `visibility`가 `PUBLIC`인지 확인을 추가. 0.3절 0-a 순서를 '목록 검사 → 공개 전환 → 첫 push → Pages 활성화'로 맞춤 |
| T0.1a (신규) | 판정 0-a의 Pages 활성화. 공개 전환 후 coordinator가 `gh api -X POST repos/01044402345o-beep/detour/pages -f build_type=workflow`로 수행하고, 실패 시에만 **[사용자]** task로 바꿔 Settings → Pages → Source를 'GitHub Actions'로 설정. 완료 조건: `build_type`이 `workflow`. 진행 현황 표 Phase 0 task 수 3 → 4 |
| 판정 참고 사항 | T3.1의 "`screens/Settings*`의 오프라인 표시 부분" 부분 소유 표현은 판정대로 그대로 둠 |
| 문서 버전 | v0.3, 변경 이력 추가 |

## 미반영

없음.
