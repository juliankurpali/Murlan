# Murlan

Offline four-player Murlan for iPhone: play against three bots in 2v2 or individual mode. English and Albanian UI. Online play, accounts, and ads are out of scope.

## Requirements

- Node.js 22.13+, 24.3+, or 26+ (Expo SDK 58). Node 23 may warn but usually still runs.
- npm 10+
- Xcode + iOS Simulator, or Expo Go on a physical iPhone

## Install

```bash
npm install
```

## Run

Start the Metro bundler:

```bash
npm start
```

Then:

- Press `i` for the **iOS Simulator**
- Scan the QR code with **Expo Go** on a physical iPhone

Or:

```bash
npx expo start
npx expo start --ios
```

If Expo Go on a physical iPhone is still on SDK 57, use the iOS Simulator with this SDK 58 project.

## Checks

```bash
npm run typecheck
npm test
```

`npx expo-doctor` checks Expo dependency alignment.

## Layout

- `src/domain/` — pure TypeScript engine (no React Native)
- `src/application/` — start, play, pass, bots, next hand, resume
- `src/storage/` — AsyncStorage save/resume
- `src/screens/` and `src/components/` — UI
- `tests/` — engine and application tests

See `GAME_RULES.md`, `ARCHITECTURE.md`, and `MILESTONES.md` for product rules.

## Documented rule defaults

Uncertain house-rule points are config flags on each match, not silent guesses:

- Flush is enabled and beats ordinary combinations and bombs (`flushEnabled` and `flushBeatsBomb`).
- The first two clockwise recipients left of the dealer get 14 cards (`fourteenCardPolicy: dealOrder`).
- Later hands: last place leads after the exchange. If last place is dealt both jokers, there is no exchange and first place leads.
- Between-hand card exchange is on: last place gives their highest card to first place, who chooses a card to give back.
- Passing on an empty lead is illegal (`allowPassOnLead: false`).
- If two players or teams reach the target in the same hand, the target increases by 10.
