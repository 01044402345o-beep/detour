# Phase 1 문서 수정 (Claude)

- 수정일: 2026-11-23. 대상: `prd.md` v0.4 → v0.5, `task.md` v0.4 → v0.5.
- 입력: `reviews/docs_review_phase1.md`(Codex, H0/M2/L3), `reviews/docs_review_phase1_verdict.md`(판정: 타당 5). 판정의 '대체 문구'를 그대로 붙여 넣었다.
- 수정한 파일: `prd.md`, `task.md`, 새 파일 `reviews/docs_fix_phase1.md`. 다른 파일과 git은 건드리지 않았다. task.md의 기존 체크 표시(9개)와 진행 중 표시(T1.2)는 그대로다.

## 결정 반영

| ID | 누구 | 결정 | 반영 |
|---|---|---|---|
| U-1 | 사용자 | 동의: 현장 확인 전 장소는 확인일 대신 "현장 확인 전 · 예시 정보" | PRD F-03·F-04, PRD 상단 v0.5, PRD 변경 이력 v0.5 행 |
| C-1 | coordinator | 권장안: 장소 단위 `verified` 필드, T1.1b 신설 | task.md Phase 1에 T1.1b 추가(체크 비움, '(진행 중 · Claude worker)' 표시), T1.2에 연결 문구 |

## 항목별 반영 내용

| ID | 반영 위치 | 반영 내용 | 비고 |
|---|---|---|---|
| DOC-M-01 | task.md T2.0 `ui/ListenButton`, T2.4 | T2.0에 TTS 사용 계약 ①~④(마운트 시 `init()`, 탭에서는 `speak()` 동기 호출, `onEnd` 처리, cleanup `cancel()`·`bindAutoCancel()` 루트 1회) 추가. T2.4 끝 문장을 "문장·단어 칩 듣기는 `ui/ListenButton`을 사용(TTS 계약은 T2.0 참조 — T1.5 R3)"로 교체 | requesting 15초 등 기한 문구는 판정대로 유지 |
| DOC-M-02 | prd.md F-03·F-04·변경 이력, task.md T1.1b(신규)·T1.2·T2.2·T2.3·T4.1a | PRD 대체 문구 2곳과 v0.5 이력 행. task.md에 T1.1b(Place.verified, downtown.json 4곳 false, validate 필수 검사, i18n 키 1개) 추가. T1.2에 "T1.1b 확인 전 표시 키 1개 추가(예: `place.unverified`)" 연결 문구. T2.2·T2.3·T4.1a 대체 문구 반영 | T1.2 연결 문구는 판정 본문(키 1개 추가, 한국어 원문, T4.2 검수)을 그대로 옮김 |
| DOC-L-01 | task.md T2.6 | 리포트 끝 문장을 판정 대체 문구로 교체(`extraVisitRate`·`nextPlaceDistribution`에 `ssd` 전달, 이벤트 지표 "최근 500건 기준", 제보 건수는 `reports.length`) | `topPhrases` 범위 설명은 판정대로 넣지 않음 |
| DOC-L-02 | task.md T4.3 | 실측 기록 한 줄을 실측 시나리오 ①~⑤로 교체 | iOS 사파리 미검증 정책 유지 |
| DOC-L-03 | task.md 상단 기준 문서·버전, 변경 이력 | 기준 문서를 U-1 동의 문안(`prd.md` v0.5, v0.4·v0.5 변경분은 docs_review_phase1로 검토)으로 교체. 상단 버전 v0.5. 변경 이력에 판정 제시 v0.5 행 추가 | 이전 이력 행은 수정하지 않음 |

## 기타

| 대상 | 내용 |
|---|---|
| 진행 현황 표 | T1.1b 추가에 맞춰 Phase 1 task 수 6 → 7. 완료 수(5)는 그대로 |
| 판정의 선택 사항 | E2E 6 '추가 방문 비율' 문구는 판정에서 선택 사항이므로 넣지 않음 |

## 미반영

없음.
