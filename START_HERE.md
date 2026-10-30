# Murlan iPhone Game — Cursor Starter Pack

## What to do
1. Open Cursor and create an empty project folder named `murlan-ios`.
2. Copy this starter pack into that folder (or open this folder directly in Cursor).
3. Open `CURSOR_FIRST_PROMPT.md`, copy the entire prompt, and send it to Cursor Agent.
4. Let Cursor inspect the repository and propose a plan before writing code. Approve implementation in small milestones.
5. Do not ask Cursor to build online multiplayer yet. First get the offline game engine and a playable table working.

## Product decisions
- iPhone-first card game; landscape gameplay table.
- Four seats.
- Match modes: 2v2 (default) and individual/free-for-all.
- Offline play against three AI opponents is the first milestone.
- Online multiplayer, private rooms, matchmaking, accounts, leaderboards and cloud persistence are later milestones.
- English and Albanian UI should be supported from the beginning.
- No ads, payments or monetization in the initial product.
- Keep rules/engine independent from UI and network transport.
- Prioritize reliability: preserve an offline match across app backgrounding, interruption and app restart where practical.

## Important rules caveat
Murlan has regional and app-specific variants. `GAME_RULES.md` defines a proposed baseline, not an assertion that every Albanian table uses exactly these rules. In particular, flushes, card exchange, opening card, ace/2 handling and scoring differ between published descriptions. Implement the rules as configurable policies and do not silently invent missing rules.
