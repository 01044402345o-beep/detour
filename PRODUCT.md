# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Primary: short-term foreign visitors (English, Japanese, Chinese speakers) who arrive at Daejeon Station by KTX and walk Daejeon's old downtown (Eunhaeng-dong, Seonhwa-dong) and the station / Jungang Market area. They use a phone outdoors, often one-handed and in daylight, while walking.
- Shop staff (Korean speakers) read the "Show to staff" screen and tap a reply button.
- Current stage: a demo for judging at a startup idea competition (창업중심대학 지역문제 해결 아이디어 경진대회). Judges see it for a few minutes.

## Product Purpose
Lower the language and wayfinding barrier for foreign visitors so they can walk a course, enter real local shops and order in Korean without help. Success in the demo: a visitor goes home → course → place → order sentence → shows it to staff, and the staff reply appears in the visitor's language.

## Positioning
Real Daejeon shop names and real menus; the Korean order sentence is generated with correct grammar (native counters 한/두/세, units 개·공기, 인분); staff answer with buttons (네 / 품절이에요 / 잠시만요 / 계산대에서 결제해 주세요) shown back in the visitor's language. No install: a PWA that also works offline.

## Operating Context
- Courses: old downtown half-day course (start Daejeon Station west plaza, 4 stops, about 2.2 km) and a traditional market course (Daejeon Jungang Market). Yuseong Spa is a future area.
- Walking directions open the NAVER Map app; the in-app map is a reference.
- Phrases per place (3-5), listen at normal and slow speed, speech practice with a "recognition match" score.

## Capabilities and Constraints
- UI in three languages (EN / JA / ZH). Korean sentences stay Korean. The staff-facing screen text and the operator report (for institutions) stay Korean.
- Offline support via service worker; first visit precaches.
- Menu, prices, hours, closures and order method are sample values until verified on site. Unverified items must be labelled ("not yet verified on site · sample info"; prices "sample price" / "price TBC"; allergens "check needed") — shown once and quietly, never presented as verified.
- Operator report and demo reset exist for the demo; they should not sit in the tourist's main path.
- Stack: React 19 + Vite, hash router, deployed to GitHub Pages under /edulleo/. Unit and E2E tests must keep passing.

## Brand Commitments
- Name: Edulleo (에둘러). English "Edulleo" is the main mark; Korean documents first mention "Edulleo(에둘러)". Logo letter E.
- English tagline: "Daejeon, one detour at a time."

## Evidence on Hand
- Real shop names and menus (sample prices) in app/src/data.
- Photographs (owner decision 2026-11-26): use freely licensed Wikimedia Commons photos of the real places (CC BY-SA, credited on screen and in a credits list; see DESIGN.md §5). Places with no free photo use a typographic tile. Never use photos of other cities, generic stock food shots, or invented shop imagery. Own photos taken during on-site checks are a replacement candidate (not decided).

## Product Principles
1. The "Show to staff" moment is the heart of the product; everything leads to it.
2. What a walking visitor needs next comes first; everything else is one tap away.
3. Never present unverified information as real.
4. A visitor must never get stuck because of language.

## Accessibility & Inclusion
Text contrast at least 4.5:1 (PRD section 7), touch targets at least 44px, readable outdoors in sunlight, respect reduced motion, screen-reader names on controls.
