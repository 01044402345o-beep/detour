# task.md 수정 R1 (Claude)

- 수정일: 2026-11-23. 대상: `task.md` v0.1 → v0.2.
- 입력: `reviews/task_review_r1.md`(Codex, H2/M10/L0), `reviews/task_review_r1_verdict.md`(판정: 타당 8 / 부분 4 / 부당 0, 추가 관찰 A-1·A-2). 판정의 수정 지침 범위 안에서만 고쳤다.
- 수정한 파일: `task.md`, 새 파일 `reviews/task_fix_r1.md`. 목업 등 다른 파일은 건드리지 않았다(M-05 목업 문구는 coordinator가 따로 고침).

## 사용자 결정 반영

| 항목 | 결정 | 반영 위치 |
|---|---|---|
| M-10 | `app/`, `prd.md`, `task.md`, `mockup/`, `reviews/`, README, `.github/`, `.gitignore` 모두 공개. 빌드 산출물(node_modules, dist, coverage, test-results, playwright-report, .env*) 제외 | 0.3절 |
| A-1 | 네이버 지도 웹 길찾기 기본, Google Maps는 장소 보기 보조 링크 | T2.2, T2.3, T4.3 |
| M-09 | 확보 기기: 안드로이드+크롬(진행자), PC 크롬/엣지(운영자 리포트). iOS 사파리는 '미검증', 심사위원 iPhone은 텍스트·직원 화면 완주 경로로 대응 | T4.3 |
| (선택) M-07 | 인분 발음은 판정 권장대로 이어 읽는 발음(연음) 기준 | T1.3 |

## 항목별 반영 내용

| ID | 반영 위치 | 반영 내용 요약 | 미반영·비고 |
|---|---|---|---|
| H-01 | 0.3절, Phase 0 E2E, Phase 3 E2E | 배포 절차 ① dev 후보 커밋 고정 ② `vite build` + `vite preview`에서 phase E2E ③ 같은 커밋 main 병합·배포 ④ 배포 URL smoke(200·콘솔 오류 0·SW 등록, Phase 3부터 오프라인 포함), ④ 실패 시 main 되돌림. Phase 0은 ②를 'build 성공'으로 대신 | — |
| H-02 | Phase 4, T2.1 | T4.1·T4.2·T4.4 결과 수령 → 신규 T4.1a(coordinator 반영, 도보 시간·총거리 재계산, 검토 루프) → Phase 4 E2E → 배포 → T4.3·T4.5는 배포 커밋 해시 기록 후 수행. 연락처 표시 자리는 T2.1(설정 하단)에 배정 | — |
| M-01 | T0.2, T1.2, T1.3, T1.4, T1.6, Phase 1 E2E | T0.2에 공유 계약(`OrderSentence`·`ScoreResult`·`SttState`·`TtsState`, `toNative`/`toSino` 시그니처, store `lang` 골격). T1.2 `t(lang, key)` 순수 함수·`useT()`는 store 계약만 import. T1.4는 시그니처만 의존·fixture 테스트. Phase 1 종료에 실제 import 연결 상태 전체 테스트 | — |
| M-02 | Phase 3, T0.2, T3.1, T3.2 | Phase 3을 T3.1 → 빌드 고정 → T3.2 순차, T3.3만 병렬로 변경. T3.1 소유에 `screens/Settings*` 오프라인 표시 부분, `ui/Toast` 연결, `vite.config.ts`, `package.json`·lock 추가. T0.2 의존성에 `vite-plugin-pwa` 추가. T3.2 수정은 coordinator가 담당 task로 되돌림 | — |
| M-03 | 0.2절, T2.0, T2.6, T0.2 폴더 구조 | 0.2절에 ① 같은 이름 `*.test.ts(x)` 자동 소유 ② 체크·커밋·push는 coordinator만 ③ 화면별 이벤트는 store 액션으로 기록 ④ `ui/ReportSheet`는 T2.6 소유, T2.3은 import만. T2.0에 `screens/<이름>/index.tsx` lazy import placeholder와 `{ src: 'order'\|'phrase', phraseId? }` 계약. Playwright는 `app/e2e/`, coordinator 작성·실행 | 별도 통합 task는 판정대로 두지 않음 |
| M-04 | T2.0~T2.6, T1.6, Phase 2 E2E 7 | F-01 `ui/Pronunciation`(EN·ZH 로마자/JA 가타카나), F-02 오늘의 코스(T2.1), F-03 목록 이동 시간·확인일·핀/목록 → 상세(T2.2), F-04 길찾기(T2.3), F-05 1에서 − 시 삭제·모든 가격 확인 시 합계(T2.3), F-07 `ui/ListenButton` 안내(T2.0), F-09 단어별 색·사용자 언어 팁(T2.4), F-10 전체 화면·주문 목록·일반 문장 목록 숨김(T2.5), F-13 장소·문장 북마크 추가·해제(T2.3·T2.6), F-16 지표 4종(T2.6). T1.6 `takeout:false` 강제, E2E 7 "성심당 포장 → 광천식당 → '포장해 주세요' 없음" | — |
| M-05 | 0장, T1.2, Phase 2 머리말, Phase 2 E2E 5 | 'PRD 우선' 규칙 추가. T1.2에 목업 `privacy` 키를 '이용 기록은 이 기기에만 저장됩니다(음성은 저장하지 않음)' 취지로 교체, 하드코딩 검사 예외 목록(한국어 콘텐츠 JSON·직원 화면 고정 문구·상호명), 빈 문자열·영어 fallback 검사. E2E 5는 "UI 문구 전환 + 한국어 고정 영역 유지" | 목업 파일 수정은 지시대로 하지 않음(coordinator 담당) |
| M-06 | Phase 2 공통 완료 조건, T1.4, T3.3, T4.5 | T2.1~T2.6 공통 완료 조건(동작별 컴포넌트 테스트 + `reviews/T2.x_screens.png`). T1.4 점수 산식 `round(100 × (1 − 거리 / max(목표, 인식 자모 수)))` 하한 0, 단위 기준 수사 변환(개·공기·명 → 고유어, 인분 → 한자어), 기대값 예시 3개. T3.3 슬라이드에 QR 삽입 후 스캔. T4.5 180초 이내, 두 경로 각 1회 | 사용자 task의 입력/기대 결과·증거 파일 요구는 판정대로 제외(T4.1a가 반영 담당) |
| M-07 | T1.3 | 표 위에 표기 정책(연음 반영 발음 기준, 된소리 미표기). 인분 1·3·6·7·8을 `irinbun/イリンブン`, `saminbun/サミンブン`, `yuginbun/ユギンブン`, `chirinbun/チリンブン`, `parinbun/パリンブン`로 수정. `공기` 열 9칸 추가, 완료 조건 27칸 | — |
| M-08 | Phase 2 E2E 3, Phase 3 E2E, T3.1, T4.3, 0.1절 | E2E 3을 "미지원/권한 거부/무음/타임아웃 → 직원에게 보여주기 → '네' → 손님 언어 표시까지 완주"로 확장. Phase 3 오프라인은 "준비 완료 대기 → 차단 → 새로고침 → 미방문 장소 상세·문장 모음·약도". T3.1 완료 조건에 업데이트 토스트 → 새 버전 적용 수동 확인. T4.3·0.1절에 자동 E2E는 목 기반, 실제 음성 증거는 T4.3 문서뿐 | — |
| M-09 | 0.1절, T3.2, T4.3 | Playwright 프로젝트 추가(360×780·430×932는 시나리오 1·5, 1280×800은 `/report`). T3.2에 axe + 44px 자동 검사. T4.3에 실제 기기·OS·브라우저 버전 기록, 미확보는 '미검증' (사용자 결정 반영) | — |
| M-10 | 0.3절, T0.1 | 빌드 산출물 명시 제외 목록. T0.1 완료 조건을 `git ls-files` → `reviews/T0.1_files.txt`, 허용 경로만. coordinator 한 명이 소유 파일만 `git add <경로>`로 stage. 공개 범위는 사용자 결정대로 `reviews/` 포함 | — |
| A-1 | T2.2, T2.3, T4.3 | Start walking·길찾기는 네이버 지도 웹 길찾기 기본, Google Maps는 장소 보기 보조. T4.3에서 실기기 도보 경로 표시 확인 | 한국 내 Google Maps 도보 길찾기 제공 여부는 판정대로 **확인 필요** |
| A-2 | T1.3 | 3인분 `saminbun/サミンブン` (M-07과 함께 반영) | — |

## 미반영

없음. 판정이 제외한 확장(별도 통합 task, 사용자 task의 증거 파일 요구, iOS 사파리·엣지 실기기 매트릭스)은 지침대로 넣지 않았다.
