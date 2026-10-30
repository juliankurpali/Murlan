# Prompt for Cursor Agent

You are the senior React Native/TypeScript engineer for a production-quality iPhone card game called Murlan.

Read `START_HERE.md`, `GAME_RULES.md`, `ARCHITECTURE.md` and `MILESTONES.md` before coding. Treat those files as the product requirements. If the repository is empty, scaffold it. If it already contains code, inspect it first and preserve useful work.

## Product goal
Build a polished, reliable iPhone implementation of the Albanian four-player card game Murlan. The first deliverable is a fully playable OFFLINE game against three bots. Both 2v2 and individual modes must be selectable. Online multiplayer is explicitly out of scope for the first milestone, but the architecture must allow it later without rewriting game rules.

## Required technology
- React Native with Expo and TypeScript.
- Use the current stable Expo-compatible packages; verify compatibility before installing.
- Use Expo Router only if it makes navigation clearer; otherwise use a simple navigation structure.
- Use a small, maintainable state-management approach. Avoid adding libraries without a concrete need.
- Unit tests for the pure game engine (use Jest or the current Expo-recommended compatible setup).
- Persist offline match state locally using an Expo-compatible storage solution. Do not store secrets.
- Do not add a backend, Supabase, authentication, ads, analytics, purchases or monetization in this milestone.

## Non-negotiable engineering rules
1. Put all card rules and turn logic in a pure TypeScript game engine, independent of React Native.
2. The UI must never decide whether a move is legal. It calls the engine and renders the result.
3. Use deterministic, serializable game state. Keep randomness injectable/seedable for tests.
4. Do not expose opponents' hands in UI state or logs. For local offline play the app has the full state internally, but components should receive only the information each seat is allowed to see.
5. Never silently guess ambiguous Murlan rules. Follow `GAME_RULES.md`; represent uncertain variants as explicit configuration options.
6. Do not build fake online functionality or pretend online play works.
7. Handle app backgrounding and foregrounding without losing the current hand. Add a clear Resume Game path.
8. Keep components reasonably small and typed. Avoid `any`, giant components, duplicated rule logic and premature abstractions.
9. Add accessible labels, readable card text, and touch targets suitable for phones.
10. No copyrighted card artwork or assets copied from another app. Use original/simple vector or CSS-like card designs.

## First milestone — implement only this
A. Project setup
- Create a clean Expo + TypeScript app.
- Add scripts for start, typecheck, lint (if configured), and tests.
- Add a README with exact setup/run/test instructions.

B. Pure game engine
- Define card, suit, rank, combination, player, team, phase and game-state types.
- Implement a standard 54-card deck: 52 standard cards plus distinguishable black and red jokers.
- Shuffle with injectable random source.
- Deal every card to four seats; two seats receive 14 and two receive 13.
- Implement combination detection/validation and beating rules from `GAME_RULES.md`.
- Implement turn order, pass handling, trick reset, player finishing order, hand completion and scoring.
- Implement both 2v2 and individual scoring.
- Implement configurable rules for disputed rules described in `GAME_RULES.md`.
- Add tests for every rule and edge case. Do not proceed to polished UI while core tests are failing.

C. Offline AI
- Implement three bot seats.
- Bots must choose only legal moves.
- Start with a simple deterministic heuristic: use the lowest-cost legal response, preserve high cards/bombs where sensible, and lead a valid low-cost combination. Do not claim the AI is advanced.
- AI must never see or use hidden information that a human player would not know. For a simple local game, it may reason from its own hand and public history only.

D. UI
- Home screen: New Game, Resume Game, Rules, Settings.
- New Game setup: choose `2v2` or `Individual`; choose language `English` or `Shqip`; start offline match.
- Game table: four seats, player names, team indicators in 2v2, current trick, pass/play controls, player's hand, clear turn indicator, and remaining card counts.
- Sort player's hand by rank and suit; allow selecting one or more cards; highlight only combinations that the engine says are legal responses.
- Show clear feedback for invalid attempts and pass state.
- Show finishing order and score after a hand; allow next hand and return to menu.
- Provide a basic rules screen.
- Landscape gameplay is preferred. Make navigation and orientation behavior robust; do not let orientation handling crash the app.
- Visual design: clean modern card-table aesthetic, high contrast, smooth but restrained animations. Prioritize clarity over decoration.

E. Persistence and recovery
- Save the current offline match after every committed action.
- Restore the current match after app restart.
- Handle app switching/backgrounding. Do not rely on a timer or animation finishing to commit a move.
- Provide a safe new-game confirmation if an unfinished match exists.

## Proposed folder structure
Use this as a guide, not a rigid requirement:
- `src/domain/cards/`
- `src/domain/rules/`
- `src/domain/game/`
- `src/domain/ai/`
- `src/application/`
- `src/storage/`
- `src/i18n/`
- `src/components/`
- `src/screens/`
- `src/theme/`
- `tests/`

## Definition of done for milestone 1
- `npm install` succeeds.
- App starts in Expo.
- `npm run typecheck` passes.
- `npm test` passes.
- A human can complete a full offline match against three bots in either mode.
- No illegal bot move can be produced.
- Reloading the app restores a saved unfinished match.
- The rules engine has no React Native imports.
- README explains how to run on an iPhone simulator/device.
- No online, ads, payment or account features are presented as working.

## Workflow
First inspect the repository and return:
1. a short implementation plan,
2. proposed dependencies with reasons,
3. any conflicts or ambiguities found in the requirements.

Then implement in small steps. After each step run typecheck and tests, fix failures, and summarize changed files. Do not dump the entire app into one file. Do not skip tests. If a rule is ambiguous, keep it behind a configuration option and document the default rather than inventing behavior.
