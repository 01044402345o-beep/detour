# Phase 6 계획 R3 판정 (Claude)

검토: `reviews/P6_plan_r3.md` (H0 M3 L0). 판정 단계에서는 문서·코드를 고치지 않았습니다.

| ID | 판정 | 조치 방향 |
|---|---|---|
| R3-M-01 검사 중 사전 일관성 | 타당 | 병렬 묶음 동안 worker의 검사 결과는 '잠정'으로 둠. worker 완료 판정은 coordinator가 모든 패치를 직렬 재적용하고 쓰기가 멈춘 상태에서 tsc·해당 task 테스트·i18n 검사를 다시 돌려 통과한 뒤에 함 |
| R3-M-02 시안 원본 고지 누락 | 타당 | 6장 원본 메타데이터(EXIF Copyright·Credit)를 확인해 `mockup/redesign/CREDITS.md`에 원본 고지 열 추가(성심당 `trainholic's travel`, 유성 `CC-BY-SA P.M.Lydon`, 옛 충남도청 `Copyright 2007 by Yoo Chul Chung. Licensed under CC-BY-SA-2.5`, Minseong Kim 3장 `CC-BY-SA 4.0`). 앱 photos.ts notice에도 같은 값 |
| R3-M-03 사진 제외 정책 vs 고정 6장 | 타당 | T6.0 완료 조건을 '권리 점검을 통과한 사진 전부(현재 후보 6장)'로 바꾸고, 제외 사진은 public·사전 캐시에서도 빼며 제외 목록·사유·글자 타일 대체를 기록. 기준 문구를 '불확실하면 제외'로 DESIGN·PRD와 통일 |
