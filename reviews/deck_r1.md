# 대전 디투어 심사 발표 덱 R1 리뷰

검토 범위: `deck.json`에 등록된 11장과 각 `<aside>` 대본, 제품 문서·소스·측정 기록. 아래 `slides/`와 `deck.css`는 지정된 임시 덱 프로젝트 기준이며, 나머지는 프로젝트 루트 기준입니다. HTML/CSS 정적 검토로, 실제 투사 화면·`/_blob/` 이미지 내용·QR 동작은 이번 검토에서 확인하지 않았습니다. 미등록 `demo.html`, `quality.html`은 발표 11장에 포함하지 않았습니다. 외부 통계의 진위를 판정한 것이 아니라 제출 자료 안에서 근거를 추적할 수 있는지 검토했습니다.

전체 흐름은 문제 → 해결 → 제품 → 차별점 → 실증 → 사업화 → 확장으로 자연스럽습니다. 다만 실제 구현과 향후 실증 계획이 섞이는 부분이 심사 위험을 만듭니다. 10장의 **4곳·메뉴 8·문장 14**는 `app/src/data/downtown.json`을 집계한 값과 일치하며, AI 초안을 계획으로 표시한 점도 적절합니다.

[H-1] 8·validate — 세 가지 측정이 모두 이미 자동 집계된다는 대본은 구현과 다릅니다. 유성 1박 배너는 준비 중 토스트만 띄우며 선택 이벤트가 없고, 도움 요청 횟수·과업 소요 시간 측정도 정의되어 있지 않습니다. — 근거: `slides/validate.html:6`, `slides/validate.html:7`, `slides/validate.html:9`, `slides/validate.html:12`; `app/src/screens/Home/index.tsx:31`, `app/src/screens/Home/index.tsx:132`; `app/src/domain/events.ts:12`, `app/src/domain/events.ts:59`; `app/src/screens/Report/sample.ts:47`의 1박 비율은 고정 예시값 7입니다. — 제안: “현재: 기기 내 화면 열람·문장 사용 집계 / 실증: 도움 요청·시간 관찰, 1박 안내 선택 기록 추가”로 나누고, 대본의 “이 측정은 앱에 이미”를 삭제합니다.

[H-2] 8·validate, 9·business — 화면 열람을 실제 추가 방문·이동으로 해석합니다. 현재 ‘추가 방문 비율’은 성심당 상세 화면을 연 세션 중 다른 장소 상세 화면을 연 세션의 비율입니다. 실제 이동 증가를 검증하지 못하고, 1박 안내 선택 역시 실제 숙박 전환을 입증하지 못합니다. — 근거: `slides/validate.html:5`, `slides/validate.html:7`, `slides/validate.html:12`; `slides/business.html:3`, `slides/business.html:16`; `app/src/domain/events.ts:114`, `app/src/domain/events.ts:128`; `task.md:198`. — 제안: 현 지표는 “다음 장소 열람률”, 향후 1박 지표는 “숙박 안내 관심률”로 명명합니다. 실제 방문·숙박은 현장 확인 또는 후속 설문 등 별도 측정으로 두고, ‘늘어난다’ 검증에는 비교 기준도 제시합니다.

[H-3] 9·business — 방문객 이용 기록이 기관에 제공할 데이터로 자동 축적되는 듯하지만 현재 기록은 각 브라우저 안에만 있습니다. 예시 리포트라는 설명만으로는 다수 사용자 데이터를 모으는 단계가 아직 없다는 점이 전달되지 않습니다. — 근거: `slides/business.html:3`, `slides/business.html:7`, `slides/business.html:16`; `prd.md:66`, `prd.md:173`; `app/src/screens/Report/index.tsx:41`, `app/src/screens/Report/index.tsx:180`. — 제안: “현재: 내 기기 기록·예시 리포트 / 실증 계획: 고지·동의와 수집 범위를 정한 통합 집계 / 상품: 기관별 코스 운영·성과 리포트”로 연결합니다. “개인정보 없음”은 현재 구현의 저장 범위를 설명하는 문구로 한정하고, 미래 수집 설계까지 보장하지 않습니다.

[H-4] 10·scale — AI 초안 뒤의 “수량 표현·단위 자동 검사 구현됨”은 자유롭게 생성된 문장의 수사·단위 오류까지 검사하는 것처럼 읽힙니다. 실제 콘텐츠 검증은 필수 문자열, 번역 누락, 허용 단위 값, 단어 칩 연결 등이며, 수량 표현은 별도 고정 규칙으로 생성합니다. — 근거: `slides/scale.html:7`, `slides/scale.html:9`, `slides/scale.html:22`; `app/src/data/validate.ts:85`, `app/src/data/validate.ts:117`, `app/src/data/validate.ts:143`; `app/src/domain/orderSentence.ts:63`; `app/src/domain/numerals.ts:102`. — 제안: 구현 배지를 “필수값·번역 누락·단위 코드 검사”에 붙입니다. “주문 수량은 고정 규칙으로 생성”을 별도로 설명하고, AI 초안의 언어적 정확성 검사는 사람 검수 또는 향후 구현으로 구분합니다.

[H-5] 7·compare — “디투어뿐”, “기존 도구는 … 하나만”은 비교 제품·버전·조사 근거 없이 전체 지도·번역 앱의 능력을 단정합니다. ‘없음’ 한 칸에 대한 반례만 나와도 차별점 전체의 신뢰가 흔들릴 수 있습니다. — 근거: `slides/compare.html:3`, `slides/compare.html:5`, `slides/compare.html:7`, `slides/compare.html:9`, `slides/compare.html:13`; 출처 자리인 `slides/compare.html:11`에도 비교 조사 근거는 없습니다. — 제안: 제목을 “그 가게의 이동·이용법·주문을 하나의 흐름으로”로 바꾸고, 독점성 대신 현재 시연으로 확인 가능한 통합 경험을 강조합니다. 표를 유지하려면 비교 대상을 특정하고 확인일·근거를 붙입니다.

[M-1] 2·problem, 3·barriers, 8·validate — “참가신청서 인용 통계·보도”는 심사자가 출처를 추적하기 어렵습니다. 1,840%는 예약 플랫폼 범위가 빠졌고, 방문지 비율의 조사 연도·대상도 본문에서 알기 어렵습니다. 참고 소스에는 방문자 수 출처 자리표시자도 남아 있습니다. — 근거: `slides/problem.html:14`, `slides/problem.html:27`; `slides/barriers.html:35`; `slides/validate.html:10`; `참가신청서_개편안/src_v14/02.html:46`의 “[출처 기입]” 및 트립닷컴 그룹 표기; `참가신청서_개편안/src_v14/03.html:50`의 2024 실태조사 표기. — 제안: 슬라이드에 기관·조사 연도 또는 매체·보도일을 적고, 발표자 참고자료에 원문 링크·정확한 지표 정의를 둡니다. 확인할 수 없는 수치는 보류하고 예약 통계에는 플랫폼 범위를 명시합니다.

[M-2] 2·problem, 8·validate — 외국인 증가에서 내·외국인 통합 방문지 비율로 넘어가며 외국인의 한 곳 집중이 확인된 사실처럼 들립니다. 77.5%와 45.1%만으로 성심당 방문자의 추가 방문 부재를 알 수도 없습니다. — 근거: `slides/problem.html:3`, `slides/problem.html:21`, `slides/problem.html:22`, `slides/problem.html:27`, `slides/problem.html:29`; `slides/validate.html:5`. — 제안: “전체 관광객 조사에서 성심당 방문 비중이 높다. 외국인의 골목 이동 장벽과 추가 방문은 이번 실증으로 확인한다”로 대본을 연결하고, 통합 조사라는 조건을 차트 제목에 올립니다.

[M-3] 4·solution, 5·journey, 10·scale — “실제 메뉴”와 “정보마다 현장 확인일”을 반복하지만 제품 소개 장면에는 현장 미확인·비제휴 상태가 명확하게 드러나지 않습니다. 7장 대본은 미확인 표시를 설명하지만 10장 대본은 이미 확인일을 갖춘 자산처럼 되돌아갑니다. — 근거: `slides/solution.html:8`; `slides/journey.html:11`; `slides/compare.html:13`; `slides/scale.html:19`, `slides/scale.html:22`; `prd.md:75`, `prd.md:127`; `app/src/data/downtown.json:459`, `app/src/data/downtown.json:614`의 `verified:false`. — 제안: 5장에 “실제 상호 기반 시연 · 메뉴·가격 등 현장 확인 전 · 비제휴”를 읽을 수 있게 표시합니다. 10장은 “확인 완료 항목에 확인일 표시, 미확인 항목은 별도 표시”로 통일합니다.

[M-4] 10·scale — “앱에 바로 반영·코드 수정 없이”는 운영자가 즉시 게시하는 기능처럼 들립니다. 같은 원도심 코스의 정형 콘텐츠는 JSON으로 추가할 수 있지만, 현재 JSON은 정적 import이며 검증·빌드·재배포가 필요합니다. — 근거: `slides/scale.html:13`, `slides/scale.html:22`; `app/src/data/index.ts:5`, `app/src/data/index.ts:11`; `task.md:50`, `task.md:52`; `prd.md:69`. — 제안: “화면 로직 수정 없이 콘텐츠 파일 추가 → 검증·재배포”로 변경합니다. 즉시 게시용 관리자 기능과 구별하고, 구현 배지도 이 범위로 제한합니다.

[M-5] 5·journey — “네 번의 탭”은 네 단계 화면과 실제 조작 횟수를 혼동합니다. 예시 주문은 품목 추가와 수량 조절만으로 여러 탭이 필요하며 장소 선택·내 주문·직원 화면 이동도 별도입니다. — 근거: `slides/journey.html:3`, `slides/journey.html:6`; `app/src/screens/Place/MenuTab.tsx:93`, `app/src/screens/Place/MenuTab.tsx:100`; `app/src/screens/Order/index.tsx:180`; `reviews/T4.5_rehearsal.md:9`. — 제안: “코스 선택부터 주문 전달까지, 네 단계”로 바꿉니다.

[M-6] 5·journey → 6·staffmoment → 7·compare — ‘빵집 다음 골목으로 이동’이라는 핵심 문제를 제시한 뒤 제품 설명은 성심당 내부 주문에 머뭅니다. 직원 응답은 강점이지만 그것이 다음 장소 방문으로 이어지는 연결 장면이 빠져 있습니다. — 근거: `slides/cover.html:5`, `slides/problem.html:24`; `slides/journey.html:5`, `slides/journey.html:8`; `slides/staffmoment.html:15`; `slides/compare.html:6`. — 제안: 5장 첫 화면이나 6장 끝에 “주문 후 다음 정류장 선택 → 외부 지도 길찾기”를 한 장면으로 넣습니다. 장수를 늘리지 않고 성심당 이후 원도심 코스로 돌아오는 흐름을 보여주면 문제·제품·실증의 연결이 선명해집니다.

[M-7] 5·journey, 6·staffmoment — 실제 앱 전체 화면을 작은 폰 이미지로 보여주면서 주문 문장·직원 버튼 같은 핵심 정보까지 읽도록 요구합니다. 투사 화면에서의 가독성을 별도 확인해야 합니다. — 근거: `slides/journey.html:5`, `slides/journey.html:8`; `slides/staffmoment.html:5`, `slides/staffmoment.html:7`; `deck.css:73`의 340×523 및 `object-fit:cover`, `deck.css:232`의 300×462. 이는 정적 CSS에서 확인한 가독성 위험이며 잘림을 실측한 판정은 아닙니다. — 제안: 5장은 단계 인지용으로 사용하고, 6장은 주문 문장·응답 버튼·번역 결과를 확대 크롭하거나 큰 글씨로 재표시합니다. 앱의 확인 전·예시 표시가 크롭으로 사라지지 않게 합니다.

[L-1] 3·barriers — “전주에서 자자” 아래 “당일 귀가”는 같은 상황을 정확하게 설명하지 못합니다. 대전에서 떠나는 것과 집으로 돌아가는 것은 다릅니다. — 근거: `slides/barriers.html:29`, `slides/barriers.html:30`, `slides/barriers.html:31`. — 제안: 태그를 “대전 숙박으로 못 이어짐” 또는 “다른 도시로 이동”으로 바꿉니다.

High 5 / Medium 7 / Low 1
