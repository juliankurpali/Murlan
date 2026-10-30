# Deploying Murlan for free

Players open a link in Safari or Chrome. No App Store, no Apple account.

| Piece | Service | Cost | What it is |
|---|---|---|---|
| Website (the app) | GitHub Pages | Free (public repo) | `https://<you>.github.io/Murlan/` |
| Game server | Render free web service | Free (750 h/month = one server 24/7) | `wss://murlan-server.onrender.com` |
| Saved data | Neon free Postgres | Free (0.5 GB) | Player IDs (hashed), friends, games |
| Build + deploy + keep-awake | GitHub Actions | Free (public repo) | `.github/workflows/` |

About 45 minutes the first time.

---

## 1. Put the code on GitHub (5 min)

1. Create an empty **public** repo on github.com named `Murlan` (GitHub Pages is only free for public repos).
2. From this folder:

```bash
git add -A
git commit -m "Production deploy setup"
git branch -M main
git remote add origin https://github.com/<you>/Murlan.git
git push -u origin main
```

`server/data/` (local player data) is git-ignored and never uploaded. There are no secrets in the repo.

The first `Deploy web` run will fail with "Set the RELAY_URL repository variable". That is expected until step 4.

## 2. Create the database on Neon (5 min)

1. Sign up at [neon.tech](https://neon.tech) with GitHub. Free plan, no card.
2. Create a project `murlan`, region **Europe (Frankfurt)**.
3. Copy the **connection string** (it looks like `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`).

The server creates its one table (`murlan_state`) on first boot.

## 3. Start the game server on Render (10 min)

1. Sign up at [render.com](https://render.com) with GitHub.
2. **New → Blueprint**, pick the `Murlan` repo. Render reads `render.yaml` and proposes `murlan-server` (free plan, Frankfurt).
3. When asked for `DATABASE_URL`, paste the Neon connection string. **Apply**.
4. Wait for the first deploy (~3–5 min), then open `https://murlan-server.onrender.com/health` (use your service's URL). You should see `{"ok":true,...}`.

Your server address for the app is the same host with `wss://`, e.g. `wss://murlan-server.onrender.com`.

## 4. Publish the website on GitHub Pages (10 min)

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - Name `RELAY_URL`, value `wss://murlan-server.onrender.com` (your Render host).
3. **Actions → Deploy web → Run workflow** (or push any commit).
4. When it finishes, the site is at `https://<you>.github.io/Murlan/`.

The workflow typechecks, runs the tests, builds the web app with your server address baked in, and publishes it. Every push to `main` redeploys. Render also redeploys the server on every push.

## 5. Keep the server awake (automatic)

Render's free server sleeps after 15 minutes without traffic, and the next player waits ~1 minute for it to wake. `Keep server awake` pings `/health` every 10 minutes using the same `RELAY_URL` variable. Nothing to do, except: GitHub pauses scheduled workflows after 60 days with no commits. Re-enable it under **Actions** if that happens.

## 6. Test before sharing (10 min)

On two phones (or a phone and a laptop):

1. Open `https://<you>.github.io/Murlan/`, turn the phone sideways, tap **Play Online**. You get a player name.
2. Phone A: **Create room → Share**. On iPhone this opens the share sheet; on desktop the link is copied.
3. Phone B: open the link. A's room screen shows the join request → **Allow**.
4. B taps **Ready**, A fills bots and taps **Start Game**. Play a hand, try chat and the mic.
5. On Render, click **Manual Deploy → Restart service**, reload both phones, and check the player names and friends are still there. That proves Neon is saving.

Tip for players: in Safari, **Share → Add to Home Screen** makes it open full screen like an app.

---

## Security

What an attacker gets if they steal the whole database: usernames, friend lists, match history and table chat. Not enough to log in as anyone. Identity secrets and session tokens are stored only as SHA-256 hashes; the real secret stays on the player's device. There are no emails, passwords, phone numbers or photos on the server.

- **Secrets live only in Render.** `DATABASE_URL` is a Render environment variable (marked secret in `render.yaml`), never in the repo. The repo has no keys, and commits use your GitHub no-reply email.
- **Database:** Neon encrypts at rest and the server connects with verified TLS. Only the server's connection string can reach it.
- **Server:** only the published site (`ALLOWED_ORIGINS`) may call it from a browser; native apps are allowed. Request bodies are capped at 16 KB, socket messages at 128 KB, at most 12 sockets per IP, 30 new players per IP per hour, rate limits on every route, and internal errors are never sent to clients.
- **Privacy:** a profile is only visible to the player, their friends, and people at their table. Friends lists are visible only to their owner. Opponents' cards never leave the server.
- **Website:** a Content-Security-Policy lets the page run only its own code and talk only to the game server, which protects the login token saved in the browser.
- **GitHub:** secret scanning with push protection and Dependabot security alerts are turned on, so an accidentally committed key is blocked.

If you ever suspect a leak: in Neon, **Reset password** for the database role, paste the new connection string into Render's `DATABASE_URL`, and Render restarts with the new credentials. Players keep working because their secrets were never on the server.

## 7. Admin page (optional)

Ongoing tables are not listed on the public site. To see them:

1. On Render, **murlan-server → Environment → Add `ADMIN_TOKEN`**. Use a long random string (at least 16 characters), for example 32 hex bytes from a password manager. Save — Render restarts the server.
2. Open `https://juliankurpali.github.io/Murlan/?admin=1` and paste the same token. The page lists lobby and in-play rooms (codes, seats, waiting joiners) and refreshes every few seconds. Wrong guesses are rate-limited. If `ADMIN_TOKEN` is unset, the page reports that admin is disabled.

Do not put this token in the repo or in GitHub variables.

## What "production ready" covers now

- **Server:** reads `PORT` from the host, uses the real visitor IP behind Render's proxy for rate limits, saves to Postgres (at most every 5 s, plus a final save on shutdown), drops finished games and expired sessions hourly, `/health` check.
- **Data safety:** the database holds only hashed identities and hashed session tokens. Stolen data cannot be used to log in as anyone. Profile photos never leave the device.
- **App:** production builds talk only to `RELAY_URL` (no LAN guessing), use `wss://`, show a "turn your phone sideways" screen in portrait, real error popups in the browser, room links that work under `/Murlan/`, saved profile photos in the browser, a Full screen control (Add to Home Screen on iPhone Safari), and a locked `?admin=1` page for live tables.

## Known limits of the free setup

- **One server, no scaling.** Fine for many tables of friends; not for thousands of players.
- **Restarts end live hands for ~1 minute.** Each push to `main` redeploys the server; players reconnect and Resume. Push during quiet times.
- **iPhone Safari voice.** The browser may ask for mic permission each visit, and sound starts after the first tap on the page. Browsers add their own echo cancellation, so headphones are optional. Chat always works.
- **Your GitHub username in the address.** If you rename the GitHub account, update `ALLOWED_ORIGINS` in `render.yaml`.
- **Neon free compute** pauses after 5 idle minutes and wakes in about a second. No action needed.

## Later, when you want the App Store

Buy the Apple Developer account ($99/year), then `npx eas-cli@latest build -p ios` and `npx eas-cli@latest submit -p ios`, with `EXPO_PUBLIC_RELAY_URL` set to the same `wss://` address. The server needs no change.

## Running locally (unchanged)

```bash
npm run relay        # local server on :8787, data in server/data/platform.json
npx expo start       # Expo Go on the same Wi‑Fi
```
