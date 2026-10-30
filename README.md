# Murlan

The Albanian four-player card game. Play 2 vs 2 or individual with friends online, with table chat and voice, in English or Albanian.

- Play: `https://juliankurpali.github.io/Murlan/` (turn your phone sideways)
- Deploy: see `DEPLOY.md`
- How it works: see `ARCHITECTURE.md`
- Game rules: see `GAME_RULES.md`

## Run locally

Requires Node.js 22+ and npm 10+.

```bash
npm install
npm run relay     # game server on :8787 (data in server/data/, git-ignored)
npm start         # Expo: press i for the iOS Simulator, or scan with Expo Go on the same Wi‑Fi
npm run web       # or play in the browser
```

## Checks

```bash
npm run typecheck
npm test
npm run lint
```

## Layout

- `src/domain/`: pure TypeScript game engine (rules, combinations, scoring, bots)
- `src/platform/`: server-side identity, rooms, friends, matches
- `src/online/`: client networking and room state
- `src/feel/`: sound, haptics, voice capture and playback
- `src/screens/`, `src/components/`: UI
- `server/`: HTTP + WebSocket game server
- `tests/`: engine, platform, and voice tests

## Rule defaults

Uncertain house-rule points are config flags on each match, not silent guesses:

- Flush is enabled and beats ordinary combinations and bombs (`flushEnabled` and `flushBeatsBomb`).
- The first two clockwise recipients left of the dealer get 14 cards (`fourteenCardPolicy: dealOrder`).
- Later hands: last place leads after the exchange. If last place is dealt both jokers, there is no exchange and first place leads.
- Between-hand card exchange is on: last place gives their highest card to first place, who chooses a card to give back.
- Passing on an empty lead is illegal (`allowPassOnLead: false`).
- If two players or teams reach the target in the same hand, the target increases by 10.
