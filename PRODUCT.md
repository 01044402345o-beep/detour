# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Primary: short-term foreign visitors (English, Japanese, Chinese speakers) who arrive at Daejeon Station by KTX and walk Daejeon's old downtown (Eunhaeng-dong, Seonhwa-dong) and the station / Jungang Market area. They use a phone outdoors, often one-handed and in daylight, while walking.
- Shop staff (Korean speakers) read the "Show to staff" screen and tap a reply button.
- Current stage: a demo for judging at a startup idea competition (창업중심대학 지역문제 해결 아이디어 경진대회). Judges see it for a few minutes.

## Product Purpose
Lower the language and wayfinding barrier for foreign visitors so they can walk a course, enter real local shops and order in Korean without help. Success in the demo: a visitor goes intro → home → course → place → order sentence → shows it to staff, and the staff reply appears in the visitor's language.

## Positioning
Real Daejeon shop names and real menus; the Korean order sentence is generated with correct grammar (native counters 한/두/세, units 개·공기, 인분); staff answer with buttons (네 / 품절이에요 / 잠시만요 / 계산대에서 결제해 주세요) shown back in the visitor's language. No install: a PWA that also works offline.

## Operating Context
- Launch: a short intro (logo → feature board: course / order / staff → tagline → language choice → Start) plays every time home is opened fresh. Opening a specific screen URL with a language already chosen skips it.
- Home: three areas drawn on Daejeon Metro Line 1, in real line order.
  - Daejeon Station · Sojedong: Jungang Market food-walk course (start Daejeon Station, 4 stops, about 0.7 km) with its own "Start the course" button; a night-market line during its season.
  - Old downtown (main): half-day course (start Daejeon Station west plaza, 4 stops, about 2.2 km) with "Start the course".
  - Yuseong Spa: "Coming later" (tap shows a "coming soon" notice).
- Course: real map with a precomputed walking route (reference only). A destination picker above the directions button lets the visitor choose any stop (default: next stop) and opens NAVER Map walking directions to it.
- Voice guide: a guide button on course ("Listen to the course guide") and place ("Listen to the guide") screens opens a popup that reads a tour-guide script (course intro, signature dishes, how to order, tips) in EN / JA / ZH with the phone's built-in browser voice, shows the same text with the current sentence highlighted, play / stop / resume and slow speed. If the device has no voice for that language, a notice is shown.
- Phrases per place (3–4), listen at normal and slow speed, speech practice with a "recognition match" score.

## Capabilities and Constraints
- UI in three languages (EN / JA / ZH). Korean sentences stay Korean. The staff-facing screen text and the operator report (for institutions) stay Korean.
- Offline support via service worker; first visit precaches (photos included).
- Menu, prices, hours, closures and order method are sample values until verified on site. Unverified items must be labelled ("not yet verified on site · sample info"; prices "sample price" / "price TBC"; allergens "check needed") — shown once and quietly, never presented as verified. The voice guide also says "sample info" aloud.
- Operator report and demo reset live in Settings under "Demo tools"; they do not sit in the tourist's main path.
- Stack: React 19 + Vite, hash router, deployed to GitHub Pages under /edulleo/. Unit and E2E tests must keep passing.

## Brand Commitments
- Name: Edulleo (에둘러). English "Edulleo" is the main mark; Korean documents first mention "Edulleo(에둘러)".
- Logo: "e 우회로" — a lowercase e drawn as a detour route (open start circle → straight line → one loop → filled end dot). Word mark lowercase `edulleo` + small `에둘러`.
- Look (Phase 6, DESIGN.md): bright daytime blue (`#1D5BD6`) on a cool light ground, real place photos, a metro-line diagram as the one signature device. No dark mode, no cream/beige, no decorative gradients.
- English tagline: "Daejeon, one detour at a time."

## Evidence on Hand
- Real shop names and menus (sample prices) in app/src/data.
- Photographs (owner decisions 2026-11-26; details in DESIGN.md §5, records in app/src/data/photos.ts, list in app/public/photos/CREDITS.txt):
  - 5 Wikimedia Commons photos of the real places/areas (CC BY-SA 4.0): Sungsimdang, Euneungjeongi street, Daejeon Station, Jungang Market, Yuseong footbath. Credited near the photo and in Settings > photo credits.
  - 3 owner's own photos: 대전근현대사전시관, 광천식당, 수연분식. Author recorded as "Edulleo 운영자 (직접 촬영)" (never a personal name), shown as "Photo: Edulleo team (own photo)"; not a CC license, used in this app with permission.
  - 3 dish example photos (Wikimedia Commons, CC BY / CC BY-SA) for shops with no photo: 개천식당 만둣국, 생일집 순대국밥, 홍가네풀빵 국화빵. Always labelled "Example photo of the dish · not this shop".
  - Never: SNS or other third-party photos without the right holder's permission, photos of other cities, generic stock shots presented as the shop, invented shop imagery. Photos carrying an institution logo are used only after a 공공누리 (KOGL) license is verified. A place without a usable photo uses a typographic tile.

## Product Principles
1. The "Show to staff" moment is the heart of the product; everything leads to it.
2. What a walking visitor needs next comes first; everything else is one tap away.
3. Never present unverified information as real.
4. A visitor must never get stuck because of language.

## Accessibility & Inclusion
Text contrast at least 4.5:1 (PRD section 7; text over photos sits on a scrim of at least 0.62), touch targets at least 44px, readable outdoors in sunlight, respect reduced motion (intro auto-advance stops when a scene is chosen), screen-reader names on controls.
