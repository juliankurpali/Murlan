# Murlan architecture

How the app works **now**. This is a landscape Expo / React Native card game. The phone is a client. A Node server on port **8787** owns identities, friends, and live matches. The rules engine is the same TypeScript in `src/domain`, run on the server for online games and on the phone for offline games.

Rules of play (combinations, scoring, exchange) are in `GAME_RULES.md`. This file is about software structure.

---

## Stack

```
iPhone (Expo Go or simulator)
  index.ts → App.tsx
    MatchApp
      src/domain/            ← pure rules (deal, play, pass, score)
      src/application/       ← offline use cases + UI session reducer
      src/screens/           ← home, social hub, lobby, table, profile, …
      src/components/        ← felt, cards, seats, chat
      src/online/net.ts      ← authenticated WebSocket
      src/social/api.ts      ← HTTP /v1 identity, friends, games
      src/platform/          ← shared types, ids, match helpers
      src/feel/              ← sound, haptics, mic, playback
      src/storage/           ← settings, Keychain identity, session token
        │
        │  http:// + ws:// <host>:8787
        ▼
server/main.ts               ← HTTP + WebSocket platform
  src/platform/store.ts      ← players, friends, games, notices
  src/platform/match.ts      ← server-side engine
  server/data/platform.json  ← gitignored snapshot
```

There is **no Expo Router**. Screens are a typed union in `MatchApp`:

`home` → `social` / `setup` / `lobby` → `table` → `handResult`, plus `profile`, `rules`, and `settings`.

The app is locked to **landscape**. On the table, seats are rotated so **you always sit south** (`tableSeat` in `src/online/room.ts`).

---

## Layer 1 — Pure game engine (`src/domain`)

Unchanged. It does not import React Native, sockets, or audio.

A match is one immutable **`GameState`**. **`toPublicView(state, viewerSeat)`** is the only table payload online clients receive: own hand, card counts, trick, scores, history. Opponent cards stay on the server.

---

## Layer 2 — Identity

There is no sign-in. Opening the app does not show a registration wall, and the server never stores emails, passwords, or Apple/Google ids.

1. The phone generates a 256-bit secret and keeps it in the Keychain (`murlan.identity.v1` via `expo-secure-store`).
2. `POST /v1/guest` sends that secret once over TLS. The server stores only `SHA-256("murlan-identity-v1" || secret)` as `identityHash`.
3. A random session token is issued; only `SHA-256("murlan-session-v1" || token)` is stored. The phone keeps the raw token in the Keychain (`murlan.auth.v2`).
4. The same secret on the next launch returns the same player. A stolen `platform.json` has hashes, not secrets, so it cannot authenticate as anyone.

---

## Layer 3 — Friends and social hub

Play Online opens the **social hub**, not a bare room code screen.

- Search usernames, send / accept / decline requests, remove or block.
- Presence from `lastSeen` (online if seen in the last 25s) and `playingGameId`.
- Invite a friend into a private game; join a friend’s table when a seat is free.
- **Active games** lists tables you sit in or were invited to. Resume returns you to the same seat.

In-app notices cover friend requests, accepts, game invites, friends coming online, and friends starting a match.

---

## Layer 4 — Online matches (server is the referee)

A private game has a 4-letter **room code**, mode (`2v2` or `individual`), and four seats. Empty seats can be filled with bots. Invited players may take an open seat.

**The server owns `GameState`.** Clients send `{ t: 'intent', kind, cards }` or HTTP lobby actions. The server validates with `src/domain`, then broadcasts a **`view`** built by `payloadFor` — never the full hands.

If the creator closes the app:

1. Their seat becomes `disconnected`.
2. The other three keep playing. The server auto-acts that seat after a short delay.
3. Reopening the app authenticates, finds the active game, and **Resume** restores the same seat, cards, and score.

Leaving the table menu **parks** the match (socket stays up for presence). Back on an unstarted lobby can leave the seat. `{ t: 'leave' }` is intentional; a drop is not.

Turn clock lives **on the server** (`turnDelay` / `autoAct`): ~2.8s bots, ~8s disconnected humans, ~20s connected humans.

---

## Layer 5 — HTTP and WebSocket

Same port **8787**. `npm run relay` runs `npx tsx server/main.ts`.

Phones find the host from Expo Metro (`src/online/relayUrl.ts`), then `127.0.0.1`. Override: `EXPO_PUBLIC_RELAY_URL`.

**HTTP (Bearer token)**

| Path | Job |
|---|---|
| `POST /v1/guest` | Create or resume guest |
| `POST /v1/auth/email\|apple\|google` | Upgrade / login |
| `GET/PATCH /v1/me` | Profile, username, avatar |
| `GET /v1/players?q=` | Username search |
| `GET /v1/players/:id/profile` | Stats, history, friends |
| `POST /v1/friends/request\|respond` | Social graph |
| `POST /v1/games` / `join` / `:id/invite\|bots\|start\|leave` | Tables |

**WebSocket**

| `t` | Meaning |
|---|---|
| `auth` | Session token |
| `watch` | Sit on a game you belong to |
| `intent` | Play / pass / exchange / nextHand |
| `chat` / `mute` / `speaking` / `voiceStatus` / `voice` | Table feel |
| `ping` | Presence + social snapshot |
| `social` / `room` / `view` / `chatHistory` | Server → client |
| `error` | `auth`, `forbidden`, `room-full`, `rate-limit`, … |

Rate limits cover HTTP, chat, friend requests, and non-voice socket messages. Voice binary frames are capped separately so talk is not treated as spam. Hidden cards, other players’ sessions, and rooms you are not in are not sent.

Offline **Play Offline** still runs the engine on the phone against three bots. It is not resumed.

---

## Layer 6 — Voice and chat

Voice is **not WebRTC**. Encoded microphone frames share the game WebSocket as binary `MVS1` packets but are independent of match simulation: a denied mic never pauses the hand.

Capture (`src/feel/VoiceChannel.tsx`, `webAudio.ts`, `voiceProcess.ts`): on web the mic tap is an AudioWorklet (ScriptProcessor fallback). ~40 ms float buffers at 48 kHz go through a high-pass (rumble/DC), an anti-aliased downsample (24 kHz Natural, 16 kHz Clear), a speech gate, then AGC → soft-knee compressor → limiter. The gate compares each frame to the quietest level of the last 2.5 s, so steady hum stays out but anyone talking near the phone opens it; it holds through pauses between words, sends one frame of pre-roll so first syllables are not clipped, and fades the last frame out. AGC is frozen while the gate is closed, so silence is never pumped up. While another seat is playing through the speaker, the gate needs a louder voice to open, so their echo is not sent back to them. Open frames are sent as Opus (32 kbps VoIP) when `libopus-wasm` loads, otherwise 16-bit PCM, both on the same binary websocket frame.

Playback (`voicePlay.ts`, `voiceJitter.ts`): each seat has a jitter line that waits ~180 ms, then queues ~200 ms chunks back to back on the Web Audio clock (native falls back to `AudioPlaylist` / timed players). Late packets do not leave holes, packets never overlap, a stale backlog over 1.2 s is dropped, and an underrun rebuffers. Capture already levels the mic, so receivers do not run a second booster.

Natural mode keeps a sensitive gate and long hold so far voices and laughter stay in; Clear voice uses a stricter gate, a higher high-pass, and more compression.

Chat is `{ t: 'chat' }`, 140 characters, last 40 lines. Tapping outside the table chat dock closes it.

---

## Layer 7 — Screens

| Screen | Job |
|---|---|
| **Home** | Play Online, Play Offline, Resume (online only), Rules, Settings |
| **Social hub** | Identity, active games, create/join, friends, search, invites |
| **Profile** | Username, record, win %, team/solo stats, history, friends |
| **Lobby** | Room code, seats, fill bots, start, invite friends, chat |
| **Setup** | Offline 2v2 vs individual |
| **Table** | Unchanged felt UI; data is a `PublicMatchView` |
| **Settings** | Profile photo, username, language, feel |

`appearanceForSeat(seat, human, localSeat)` treats **your** seat as the human portrait even when you are not seat 0.

---

## Storage

| Key | Contents |
|---|---|
| `murlan.settings.v1` | Language, sound, voice mode, … |
| `murlan.photoKey.v1` | Keychain key for the compressed profile photo |
| `murlan.profile.v1.bin` | Encrypted profile JPEG in the app sandbox |
| `murlan.identity.v1` | High-entropy identity secret (Keychain) |
| `murlan.auth.v2` | `{ token, playerId }` (Keychain) |
| `murlan.tableSession.v2` | `{ gameId }` so Resume can watch the same table |
| `murlan.match.v1` | Legacy offline blob — cleared on launch |

Server snapshot: `server/data/platform.json` (gitignored) locally. With `DATABASE_URL` set (production), the same snapshot lives in one Postgres row (`murlan_state`, `server/persist.ts`), written at most every 5 s and flushed on SIGTERM. On web, Keychain values and the encrypted photo fall back to browser storage.

Production: web build on GitHub Pages, server on Render, Postgres on Neon — see `DEPLOY.md`.

---

## Typical paths

**Offline:** Home → Setup → Table (seat 0 vs three bots) → Hand result → next hand or home.

**Online:** Mac runs `npm run relay` and `npx expo start`. The app proves the phone’s identity secret, then Play Online → create or join → fill bots if needed → start. The server deals. Anyone can disconnect; Resume restores the seat.

---

## Tests and commands

```bash
npm install
npm run relay          # platform HTTP + WebSocket (keep running for online)
npx expo start
npm run typecheck
npm test
```

---

## Limits

- The server process must stay running for online tables. Players’ phones do not.
- The identity secret never leaves the phone except on `POST /v1/guest`. Reinstalling the app (or clearing Keychain) creates a new player.
- Voice and gameplay still share one socket, so a dead network drops both until reconnect. Microphone failure does not.
- Storage is a single-process snapshot (file or one Postgres row), not a multi-region database. One server instance only.

Guiding principle: card legality and scoring belong in `src/domain`. Online transport sends **intents** and **public views**. Clients cannot change hidden cards or scores.
