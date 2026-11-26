# Edulleo(에둘러)

대전을 찾은 외국인 방문객(영어·일본어·중국어)이 걸어서 코스를 돌고, 실제 가게에서 한국어로 주문할 수 있게 돕는 웹앱(PWA)입니다. 창업 아이디어 경진대회 심사 시연용 데모입니다.

- 배포 URL: https://01044402345o-beep.github.io/edulleo/

## 주요 기능

- **인트로:** 페이지를 새로 불러와 홈에서 시작할 때마다(앱 안에서 홈으로 돌아올 때는 다시 나오지 않음) 기능 소개(코스 · 주문 · 직원) → 언어 선택(EN/日本語/中文) → 시작
- **홈:** 대전 도시철도 1호선 위 3권역 — 대전역·소제동(중앙시장 코스, 시작 버튼) / 원도심(반나절 코스, 시작 버튼) / 유성온천(준비 중)
- **코스:** 지도 위 도보 경로(참고용)와 정류장 목록, 가고 싶은 정류장을 골라 네이버 지도 도보 길찾기 열기
- **음성 가이드:** 코스·장소 소개를 화면 언어(영어·일본어·중국어)의 휴대폰 내장 음성으로 읽고 팝업에 글로 표시
- **주문 카드:** 메뉴를 담으면 문법에 맞는 한국어 주문 문장 생성 → "Show to staff" 화면 → 직원이 버튼으로 답하면 방문객 언어로 표시
- **현장 한국어:** 장소별 문장 듣기(보통·천천히), 말하기 연습
- **오프라인:** 첫 방문 때 사전 캐시, 이후 오프라인에서도 동작
- 가격·영업시간 등은 현장 확인 전 예시 정보이며, 화면에 그렇게 표시합니다.

## 실행 방법

```sh
cd app
npm ci
npm run dev        # 개발 서버
npm run build      # 타입 검사(tsc) + 빌드 → app/dist
npm run preview    # 빌드 결과 미리보기
npm run test       # 단위 테스트 (Vitest)
npm run e2e        # E2E 테스트 (Playwright)
npm run lint       # ESLint
npm run typecheck  # 타입 검사만
```

- E2E는 Playwright 브라우저를 내려받지 않고 **설치된 Microsoft Edge**(`channel: 'msedge'`)를 씁니다. 해당 주소(포트 4173)에 서버가 없으면 빌드 후 `vite preview`를 자동으로 띄웁니다. 이미 떠 있는 서버는 그대로 재사용하므로, 현재 소스 기준으로 검사하려면 기존 preview를 끄고 실행합니다.

## 번역(i18n) 수정 규칙

`app/src/i18n/en.json`·`ja.json`·`zh.json`은 직접 고치지 않습니다. 바꿀 키를 `app/src/i18n/patches/*.json`(형식 `{ "en": {...}, "ja": {...}, "zh": {...} }`, 세 언어 키 동일)에 적고 아래 명령을 **저장소 루트에서** 실행합니다(앞 절에서 `cd app` 했다면 `cd ..`). 패치 파일이 번역의 원본입니다.

```sh
node app/scripts/i18n-patch.mjs app/src/i18n/patches/<패치>.json
```

- 이미 있는 키의 값을 바꾸려면 패치의 `"$override"`에 점 경로로 적어야 합니다(없으면 충돌로 멈춤).
- `--check`: 파일을 쓰지 않고 적용 결과가 지금 파일과 같은지만 확인합니다.

## 배포

- `main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해 GitHub Pages에 배포합니다(수동 실행도 가능). 배포 경로(base)는 `/edulleo/`입니다.
- `dev`·`main` 푸시와 PR에는 CI(`.github/workflows/ci.yml`: lint · typecheck · test · build)가 돌아갑니다.

## 문서

- [제품 요구사항 (prd.md)](prd.md)
- [작업 목록 (task.md)](task.md)
- [디자인 기준 (DESIGN.md)](DESIGN.md)
- [제품 맥락 (PRODUCT.md)](PRODUCT.md) — 디자인 도구용 사용자·브랜드·원칙
- [검토 기록 (reviews/)](reviews/)
- 화면 목업: [mockup/index.html](mockup/index.html), 개편 시안 [mockup/redesign/](mockup/redesign/)

## 사진 출처

앱의 사진 목록과 출처·라이선스는 [app/public/photos/CREDITS.txt](app/public/photos/CREDITS.txt)에 있습니다(앱 설정 > 사진 출처에서도 확인). 위키미디어 공용 CC 사진, 운영자 직접 촬영 사진(CC 라이선스 아님, 이 앱에서만 사용), 음식 예시 사진(그 가게에서 찍은 사진 아님)을 구분해 표시합니다. 사진 라이선스는 사진 파일에만 적용되며 앱 코드와는 별개입니다.

## 안내

앱에 나오는 가게·기관과 제휴하지 않은 독립 데모이며, 가게 정보는 시연용으로만 사용합니다.
