# Development milestones

## M0 — Foundation
- Expo + TypeScript app.
- Repository structure, formatting/lint/typecheck/test scripts.
- Navigation shell and design tokens.
- Confirm build runs on iOS simulator.

## M1 — Game engine (highest priority)
- Deck, shuffle, deal.
- Combination validation and comparison.
- Turn/pass/trick flow.
- Finish order and scoring.
- Rules configuration.
- Comprehensive unit tests.
**Exit:** tests prove the rules engine; no polished UI required.

## M2 — Offline playable game
- Four-seat table.
- Human player + three bots.
- Both 2v2 and individual.
- Basic bot strategy.
- Complete hand and match flow.
**Exit:** a full match can be played end-to-end.

## M3 — Reliability and UX
- Save/resume.
- Background/foreground handling.
- Rules screen and legal-move hints.
- English/Albanian localization.
- Animations, sound toggle, settings, accessibility.
- Test on physical iPhone.

## M4 — Online technical design
- Choose backend after defining expected concurrency, cost and operations.
- Authentication/guest identity.
- Server-authoritative match state.
- Private rooms and invite codes.
- Reconnect and recovery.
**Exit:** design reviewed before implementation.

## M5 — Online multiplayer
- Private 2v2 and individual rooms.
- Random matchmaking.
- Reconnect handling and server persistence.
- Abuse/rate limiting and basic telemetry (with privacy notice).
- Test disconnects, backgrounding, duplicate requests and stale state.

## M6 — Release preparation
- App icon, screenshots, privacy disclosures, support page.
- TestFlight and device QA.
- App Store submission.
- Ads/monetization remain out of scope unless explicitly decided later.
