import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { applyUserIntent, autoAct, connectedHumans, forceEndGame, parkPlayer, payloadFor, restorePlayer, startMatch, turnDelay } from '../src/platform/match';
import { sameSecret } from '../src/platform/identity';
import { withAiLabel } from '../src/platform/ids';
import {
  BOT_REACTIONS_ENABLED,
  nextBotReactionDelay,
  occupantIdForSeat,
  occupantsOfSeats,
  pickBotReaction,
  ReactionService,
} from '../src/reactions';
import { PlatformStore } from '../src/platform/store';
import { PlatformGame, PlatformPlayer } from '../src/platform/types';
import { decodeVoiceFrame, isVoiceFrame, stampVoiceSeat } from '../src/online/voiceFrame';
import { openPostgres, Persistence } from './persist';

const PORT = Number(process.env.PORT ?? process.env.MURLAN_RELAY_PORT ?? 8787);
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || Boolean(process.env.RENDER);
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((row: string) => row.trim().replace(/\/+$/, '').toLowerCase())
  .filter(Boolean);
const MAX_SOCKETS_PER_IP = 12;
let persistence: Persistence | null = null;
const store = DATABASE_URL
  ? new PlatformStore({ initial: null, onSave: (snapshot) => persistence?.onSave(snapshot) })
  : new PlatformStore(join(process.cwd(), 'server', 'data', 'platform.json'));
const sockets = new Map<WebSocket, { playerId: string | null; gameId: string | null }>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const reactionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const reactions = new ReactionService();

type Json = Record<string, unknown>;

function send(ws: WebSocket, payload: Json) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendBytes(ws: WebSocket, bytes: Uint8Array) {
  if (ws.readyState === ws.OPEN && bytes.byteLength > 0) {
    ws.send(bytes);
  }
}

function asBuffer(raw: RawData): Buffer {
  if (Buffer.isBuffer(raw)) {
    return raw;
  }
  if (Array.isArray(raw)) {
    return Buffer.concat(raw);
  }
  return Buffer.from(raw);
}

function body(req: IncomingMessage): Promise<Json> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16_000) {
        reject(new Error('too-large'));
        req.destroy();
        return;
      }
      chunks.push(chunk as Buffer);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('bad-json'));
          return;
        }
        resolve(parsed as Json);
      } catch {
        reject(new Error('bad-json'));
      }
    });
    req.on('error', () => reject(new Error('bad-json')));
  });
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ') && header.length < 200) {
    return header.slice(7);
  }
  return null;
}

function clientIp(req: IncomingMessage): string {
  const forwarded = TRUST_PROXY ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() : '';
  return forwarded || req.socket.remoteAddress || 'ip';
}

// Native apps send no Origin; browsers must come from the published site.
function originAllowed(origin: string | undefined): boolean {
  if (!origin || ALLOWED_ORIGINS.length === 0) {
    return true;
  }
  return ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, '').toLowerCase());
}

const responseOrigin = new WeakMap<ServerResponse, string>();

function json(res: ServerResponse, status: number, payload: unknown) {
  const data = JSON.stringify(payload);
  const origin = responseOrigin.get(res);
  const allow = ALLOWED_ORIGINS.length === 0 ? '*' : origin && originAllowed(origin) ? origin : '';
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'cross-origin',
    ...(allow ? { 'access-control-allow-origin': allow, vary: 'origin' } : {}),
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-max-age': '600',
  });
  res.end(data);
}

const PUBLIC_ERRORS = /^[a-z][a-z-]{1,40}$/;

function requireAdmin(req: IncomingMessage, res: ServerResponse, ip: string): boolean {
  if (ADMIN_TOKEN.length < 16) {
    json(res, 404, { error: 'not-found' });
    return false;
  }
  const token = bearer(req);
  if (!token || !sameSecret(token, ADMIN_TOKEN)) {
    if (!store.rateOk(`admin-fail:${ip}`, 10, 10 * 60 * 1000)) {
      json(res, 429, { error: 'rate-limit' });
      return false;
    }
    json(res, 401, { error: 'auth' });
    return false;
  }
  return true;
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (PUBLIC_ERRORS.test(message)) {
    return message;
  }
  console.error('request failed', error);
  return 'server-error';
}

function playerSockets(userId: string): WebSocket[] {
  return [...sockets.entries()].filter(([, meta]) => meta.playerId === userId).map(([ws]) => ws);
}

function gameSockets(game: PlatformGame): WebSocket[] {
  return [...sockets.entries()].filter(([, meta]) => meta.gameId === game.id).map(([ws]) => ws);
}

function toRelayRoom(game: PlatformGame) {
  return {
    id: game.id,
    code: game.code,
    hostId: game.createdBy,
    started: game.status === 'playing',
    mode: game.mode,
    seats: game.seats.map((seat, index) => {
      if (!seat.userId && !seat.isBot) {
        return null;
      }
      const player = seat.userId ? store.players.get(seat.userId) : null;
      return {
        name: seat.isBot
          ? withAiLabel(seat.botName ?? player?.username ?? 'Bot')
          : (player?.username ?? seat.botName ?? 'Empty'),
        ready: Boolean(seat.userId || seat.isBot),
        lobbyReady: Boolean(seat.lobbyReady || seat.isBot || seat.userId === game.createdBy),
        isBot: seat.isBot,
        muted: seat.muted,
        speaking: seat.speaking,
        voiceAvailable: seat.voiceAvailable,
        connection: seat.connection,
        playerId: occupantIdForSeat(game.id, index, seat.userId, seat.isBot),
      };
    }),
    pendingJoins: store.pendingJoins(game),
  };
}

function notifyPlaying(game: PlatformGame) {
  for (const seat of game.seats) {
    if (!seat.userId) {
      continue;
    }
    const player = store.players.get(seat.userId);
    if (!player) {
      continue;
    }
    for (const friend of store.friendsOf(seat.userId)) {
      store.notify(friend.id, 'friend-playing', seat.userId, `${player.username} started a game.`);
      const peer = store.players.get(friend.id);
      if (peer) {
        pushPlayer(friend.id, social(peer));
      }
    }
  }
}

function pushPlayer(userId: string, payload: Json) {
  for (const ws of playerSockets(userId)) {
    send(ws, payload);
  }
}

function broadcastGame(game: PlatformGame) {
  for (const ws of gameSockets(game)) {
    const meta = sockets.get(ws);
    if (!meta?.playerId) {
      continue;
    }
    send(ws, { t: 'room', room: toRelayRoom(game) });
    const table = payloadFor(game, meta.playerId);
    if (table) {
      send(ws, { t: 'view', ...table });
    }
    send(ws, { t: 'chatHistory', messages: game.chat });
  }
}

function stopBotReactions(gameId: string) {
  const prev = reactionTimers.get(gameId);
  if (prev) {
    clearTimeout(prev);
  }
  reactionTimers.delete(gameId);
}

function fireBotReaction(game: PlatformGame) {
  if (game.status !== 'playing' || !game.match) {
    return;
  }
  if (game.match.phase !== 'playing' && game.match.phase !== 'exchanging') {
    return;
  }
  const occupants = occupantsOfSeats(game.id, game.seats);
  const botIds = game.seats.flatMap((seat, index) =>
    seat.isBot ? [occupantIdForSeat(game.id, index, seat.userId, true)].filter((id): id is string => Boolean(id)) : [],
  );
  const pick = pickBotReaction(occupants, botIds);
  if (!pick) {
    return;
  }
  const result = reactions.submit({
    now: Date.now(),
    room: { id: game.id, status: game.status, occupants },
    senderId: pick.senderId,
    requestId: pick.requestId,
    reactionId: pick.reactionId,
    targetPlayerId: pick.targetPlayerId,
  });
  if (!result.ok) {
    return;
  }
  for (const peer of gameSockets(game)) {
    send(peer, { t: 'reaction', ...result.event });
  }
}

function armBotReactions(game: PlatformGame) {
  stopBotReactions(game.id);
  if (!BOT_REACTIONS_ENABLED) {
    return;
  }
  if (game.status !== 'playing' || !game.match) {
    return;
  }
  if (game.match.phase === 'handComplete' || game.match.phase === 'matchComplete') {
    return;
  }
  if (!game.seats.some((seat) => seat.isBot)) {
    return;
  }
  reactionTimers.set(
    game.id,
    setTimeout(() => {
      const live = store.games.get(game.id);
      if (!live) {
        reactionTimers.delete(game.id);
        return;
      }
      fireBotReaction(live);
      armBotReactions(live);
    }, nextBotReactionDelay()),
  );
}

function ensureBotReactions(game: PlatformGame) {
  if (!reactionTimers.has(game.id)) {
    armBotReactions(game);
  }
}

function stopGame(game: PlatformGame) {
  const prev = timers.get(game.id);
  if (prev) {
    clearTimeout(prev);
  }
  timers.delete(game.id);
  stopBotReactions(game.id);
}

function notifyGameClosed(game: PlatformGame, reason?: 'admin' | 'empty') {
  const seen = new Set<string>();
  for (const seat of game.seats) {
    if (!seat.userId || seen.has(seat.userId)) {
      continue;
    }
    seen.add(seat.userId);
    const player = store.players.get(seat.userId);
    if (!player) {
      continue;
    }
    pushPlayer(seat.userId, social(player));
    for (const ws of playerSockets(seat.userId)) {
      send(ws, { t: 'chatHistory', messages: [] });
      send(ws, { t: 'ended', gameId: game.id, reason, code: game.code });
    }
  }
}

function afterPark(game: PlatformGame, ended: boolean) {
  store.save();
  broadcastGame(game);
  if (ended) {
    stopGame(game);
    notifyGameClosed(game);
    return;
  }
  schedule(game);
}

function schedule(game: PlatformGame) {
  const prev = timers.get(game.id);
  if (prev) {
    clearTimeout(prev);
  }
  if (!game.match || game.status !== 'playing') {
    return;
  }
  ensureBotReactions(game);
  if (game.match.phase === 'handComplete' || game.match.phase === 'matchComplete') {
    if (game.match.phase === 'matchComplete') {
      store.recordResult(game);
      broadcastGame(game);
    }
    return;
  }
  const wait = turnDelay(game);
  timers.set(
    game.id,
    setTimeout(() => {
      try {
        if (autoAct(game)) {
          store.save();
          broadcastGame(game);
          schedule(game);
        }
      } catch {
        /* ignore */
      }
    }, wait),
  );
}

function social(player: PlatformPlayer) {
  return {
    t: 'social',
    me: store.publicPlayer(player),
    friends: store.friendsOf(player.id),
    requests: store.pendingFor(player.id),
    inbox: store.inbox(player.id),
    games: store.activeFor(player.id),
  };
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin) {
    responseOrigin.set(res, origin);
  }
  if (!originAllowed(origin)) {
    json(res, 403, { error: 'forbidden' });
    return;
  }
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }
  const url = new URL(req.url ?? '/', `http://127.0.0.1`);
  const path = url.pathname;
  const ip = clientIp(req);
  if (!store.rateOk(`ip:${ip}`, 120, 10_000)) {
    json(res, 429, { error: 'rate-limit' });
    return;
  }
  try {
    if (req.method === 'GET' && path === '/health') {
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && path === '/v1/admin/games') {
      if (!requireAdmin(req, res, ip)) {
        return;
      }
      json(res, 200, store.adminSnapshot());
      return;
    }
    if (req.method === 'POST' && path.startsWith('/v1/admin/games/') && path.endsWith('/end')) {
      if (!requireAdmin(req, res, ip)) {
        return;
      }
      if (!store.rateOk(`admin-act:${ip}`, 30, 10 * 60 * 1000)) {
        json(res, 429, { error: 'rate-limit' });
        return;
      }
      const id = path.slice('/v1/admin/games/'.length, -'/end'.length);
      const game = id && id.length <= 80 && !id.includes('/') ? store.games.get(id) : undefined;
      if (!game || game.status === 'complete') {
        json(res, 404, { error: 'room-missing' });
        return;
      }
      forceEndGame(game);
      store.closeOpenJoins(game);
      store.notifyAdminEnded(game);
      store.save();
      stopGame(game);
      notifyGameClosed(game, 'admin');
      json(res, 200, store.adminSnapshot());
      return;
    }
    if (req.method === 'POST' && path === '/v1/guest') {
      if (!store.rateOk(`guest:${ip}`, 30, 60 * 60 * 1000)) {
        json(res, 429, { error: 'rate-limit' });
        return;
      }
      const payload = await body(req);
      const identity = String(payload.identity ?? payload.deviceId ?? '');
      try {
        json(res, 200, store.guest(identity));
      } catch (error) {
        json(res, 400, { error: publicError(error) });
      }
      return;
    }

    const user = store.auth(bearer(req));
    if (!user) {
      json(res, 401, { error: 'auth' });
      return;
    }

    if (req.method === 'GET' && path === '/v1/me') {
      json(res, 200, { player: store.publicPlayer(user), inbox: store.inbox(user.id), games: store.activeFor(user.id) });
      return;
    }
    if (req.method === 'PATCH' && path === '/v1/me') {
      const payload = await body(req);
      if (payload.username) {
        store.rename(user, String(payload.username));
      }
      if (typeof payload.avatar === 'string') {
        user.avatar = payload.avatar as typeof user.avatar;
      }
      store.save();
      json(res, 200, { player: store.publicPlayer(user) });
      return;
    }
    if (req.method === 'GET' && path === '/v1/players') {
      json(res, 200, { players: store.search(url.searchParams.get('q') ?? '', user.id) });
      return;
    }
    if (req.method === 'GET' && path.startsWith('/v1/players/') && path.endsWith('/profile')) {
      const id = path.split('/')[3] ?? '';
      const profile = store.profile(id, user.id);
      if (!profile) {
        json(res, 404, { error: 'player-missing' });
        return;
      }
      json(res, 200, profile);
      return;
    }
    if (req.method === 'GET' && path === '/v1/friends') {
      json(res, 200, { friends: store.friendsOf(user.id), requests: store.pendingFor(user.id) });
      return;
    }
    if (req.method === 'POST' && path === '/v1/friends/request') {
      const payload = await body(req);
      const row = store.requestFriend(user, String(payload.username ?? ''));
      json(res, 200, { ok: true, friends: store.friendsOf(user.id), requests: store.pendingFor(user.id) });
      pushPlayer(user.id, social(user));
      const other = store.players.get(row.addresseeId === user.id ? row.requesterId : row.addresseeId);
      if (other) {
        pushPlayer(other.id, social(other));
      }
      return;
    }
    if (req.method === 'POST' && path === '/v1/friends/respond') {
      const payload = await body(req);
      const id = String(payload.id ?? '');
      const before = store.friends.find((row) => row.id === id);
      store.respondFriend(user, id, Boolean(payload.accept));
      json(res, 200, { ok: true, friends: store.friendsOf(user.id), requests: store.pendingFor(user.id) });
      pushPlayer(user.id, social(user));
      const otherId = before?.requesterId;
      const other = otherId ? store.players.get(otherId) : null;
      if (other) {
        pushPlayer(other.id, social(other));
      }
      return;
    }
    if (req.method === 'DELETE' && path.startsWith('/v1/friends/')) {
      store.removeFriend(user, path.split('/')[3] ?? '');
      json(res, 200, { ok: true, friends: store.friendsOf(user.id) });
      return;
    }
    if (req.method === 'POST' && path.startsWith('/v1/friends/block/')) {
      store.block(user, path.split('/')[4] ?? '');
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && path === '/v1/inbox') {
      json(res, 200, { inbox: store.inbox(user.id) });
      return;
    }
    if (req.method === 'POST' && path === '/v1/inbox/read') {
      const payload = await body(req);
      const ids = Array.isArray(payload.ids) ? payload.ids.filter((id): id is string => typeof id === 'string') : [];
      store.markRead(user.id, ids);
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && path === '/v1/games') {
      json(res, 200, { games: store.activeFor(user.id) });
      return;
    }
    if (req.method === 'POST' && path === '/v1/games') {
      await body(req);
      const game = store.createGame(user);
      json(res, 200, { game: store.summary(game, user.id) });
      return;
    }
    if (req.method === 'POST' && path === '/v1/games/join') {
      const payload = await body(req);
      const team = payload.team === 0 || payload.team === 1 || payload.team === 2 ? payload.team : undefined;
      const seat = typeof payload.seat === 'number' ? payload.seat : undefined;
      const outcome = store.requestJoin(user, String(payload.code ?? ''), { team, seat });
      json(res, 200, { game: store.summary(outcome.game, user.id), pending: outcome.pending });
      if (outcome.pending) {
        for (const humanId of connectedHumans(outcome.game)) {
          const human = store.players.get(humanId);
          if (human) {
            pushPlayer(humanId, social(human));
          }
        }
        pushPlayer(user.id, social(user));
        return;
      }
      broadcastGame(outcome.game);
      return;
    }
    const gameMatch = path.match(/^\/v1\/games\/([^/]+)(?:\/(.*))?$/);
    if (gameMatch) {
      const game = store.games.get(gameMatch[1] ?? '');
      if (!game) {
        json(res, 404, { error: 'room-missing' });
        return;
      }
      const rest = gameMatch[2] ?? '';
      if (req.method === 'GET' && rest === '') {
        if (
          !game.seats.some((seat) => seat.userId === user.id) &&
          !store.invites.some((invite) => invite.gameId === game.id && invite.toId === user.id) &&
          !store.joinRequests.some((row) => row.gameId === game.id && row.fromId === user.id && row.status === 'pending')
        ) {
          json(res, 403, { error: 'forbidden' });
          return;
        }
        json(res, 200, { game: store.summary(game, user.id), table: payloadFor(game, user.id) });
        return;
      }
      if (req.method === 'POST' && rest === 'join') {
        const payload = await body(req).catch(() => ({} as Json));
        const team = payload.team === 0 || payload.team === 1 || payload.team === 2 ? payload.team : undefined;
        const seat = typeof payload.seat === 'number' ? payload.seat : undefined;
        const outcome = store.requestJoin(user, game.code, { team, seat });
        json(res, 200, { game: store.summary(outcome.game, user.id), pending: outcome.pending });
        if (outcome.pending) {
          for (const humanId of connectedHumans(outcome.game)) {
            const human = store.players.get(humanId);
            if (human) {
              pushPlayer(humanId, social(human));
            }
          }
          pushPlayer(user.id, social(user));
          return;
        }
        broadcastGame(outcome.game);
        return;
      }
      if (req.method === 'POST' && rest === 'admit') {
        const payload = await body(req);
        const fromId = String(payload.fromId ?? '');
        const accept = payload.accept !== false;
        const admitted = store.respondJoin(user, game.id, fromId, accept);
        json(res, 200, { game: store.summary(admitted, user.id) });
        broadcastGame(admitted);
        const from = store.players.get(fromId);
        if (from) {
          pushPlayer(from.id, social(from));
        }
        pushPlayer(user.id, social(user));
        return;
      }
      if (req.method === 'POST' && rest === 'ready') {
        const payload = await body(req).catch(() => ({} as Json));
        store.setLobbyReady(user, game, payload.ready === true);
        store.save();
        broadcastGame(game);
        json(res, 200, { game: store.summary(game, user.id) });
        return;
      }
      if (req.method === 'POST' && rest === 'seat') {
        const payload = await body(req);
        const seat = Number(payload.seat);
        const targetId = game.seats[seat]?.userId;
        const result = store.claimSeat(user, game, seat);
        broadcastGame(game);
        if (result.pending && targetId) {
          const target = store.players.get(targetId);
          if (target) {
            pushPlayer(target.id, social(target));
          }
        }
        pushPlayer(user.id, social(user));
        json(res, 200, { game: store.summary(game, user.id), pending: result.pending });
        return;
      }
      if (req.method === 'POST' && rest === 'switch') {
        const payload = await body(req);
        const fromId = String(payload.fromId ?? '');
        const accept = payload.accept !== false;
        store.respondSeatSwitch(user, game, fromId, accept);
        broadcastGame(game);
        const from = store.players.get(fromId);
        if (from) {
          pushPlayer(from.id, social(from));
        }
        pushPlayer(user.id, social(user));
        json(res, 200, { game: store.summary(game, user.id) });
        return;
      }
      if (req.method === 'POST' && rest === 'invite') {
        const payload = await body(req);
        const team = payload.team === 0 || payload.team === 1 || payload.team === 2 ? payload.team : undefined;
        const row = store.invite(user, game, String(payload.username ?? ''), team);
        const invited = store.players.get(row.toId);
        if (invited) {
          pushPlayer(invited.id, social(invited));
        }
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === 'POST' && rest === 'bots') {
        store.assertHost(user, game);
        store.fillBots(game, ['Leka', 'Drita', 'Gjergj', 'Bardh', 'Yllka']);
        broadcastGame(game);
        json(res, 200, { game: store.summary(game, user.id) });
        return;
      }
      if (req.method === 'POST' && rest === 'mode') {
        const payload = await body(req).catch(() => ({} as Json));
        if (payload.mode === 'chaos') {
          json(res, 200, { game: store.summary(game, user.id) });
          return;
        }
        store.setMatchMode(
          user,
          game,
          payload.mode === 'super' ? 'super' : '2v2',
        );
        broadcastGame(game);
        json(res, 200, { game: store.summary(game, user.id) });
        return;
      }
      if (req.method === 'POST' && rest === 'start') {
        const payload = await body(req).catch(() => ({} as Json));
        if (payload.mode === '2v2' || payload.mode === 'super') {
          store.setMatchMode(user, game, payload.mode);
        } else if (game.mode === 'chaos') {
          store.setMatchMode(user, game, '2v2');
        }
        store.assertCanStart(user, game);
        startMatch(game);
        const closed = store.closeOpenJoins(game);
        store.save();
        notifyPlaying(game);
        broadcastGame(game);
        schedule(game);
        for (const fromId of closed) {
          const from = store.players.get(fromId);
          if (from) {
            pushPlayer(from.id, social(from));
          }
        }
        json(res, 200, { game: store.summary(game, user.id), table: payloadFor(game, user.id) });
        return;
      }
      if (req.method === 'POST' && rest === 'leave') {
        const ended = parkPlayer(game, user.id, true);
        store.cancelSeatSwitches(game, user.id);
        afterPark(game, ended);
        json(res, 200, { ok: true, ended });
        return;
      }
    }
    json(res, 404, { error: 'not-found' });
  } catch (error) {
    json(res, 400, { error: publicError(error) });
  }
}

const httpServer = createServer(handleHttp);
httpServer.requestTimeout = 15_000;
httpServer.headersTimeout = 10_000;
httpServer.keepAliveTimeout = 65_000;
const socketIps = new Map<WebSocket, string>();
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 128 * 1024,
  verifyClient: ({ origin }: { origin?: string }) => originAllowed(origin),
});

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  const fromIp = [...socketIps.values()].filter((row) => row === ip).length;
  if (sockets.size > 400 || fromIp >= MAX_SOCKETS_PER_IP) {
    send(ws, { t: 'error', message: 'rate-limit' });
    ws.close();
    return;
  }
  socketIps.set(ws, ip);
  sockets.set(ws, { playerId: null, gameId: null });
  send(ws, { t: 'hello', id: 'ok' });

  ws.on('message', (raw) => {
    const buf = asBuffer(raw);
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    if (isVoiceFrame(bytes)) {
      relayVoice(ws, bytes);
      return;
    }
    if (buf.length > 120_000) {
      return;
    }
    let message: Json;
    try {
      message = JSON.parse(buf.toString('utf8')) as Json;
    } catch {
      return;
    }
    const meta = sockets.get(ws);
    if (!meta) {
      return;
    }
    if (message.t === 'auth') {
      const player = store.auth(String(message.token ?? '').slice(0, 200));
      if (!player) {
        send(ws, { t: 'error', message: 'auth' });
        if (!store.rateOk(`wsauth:${ip}`, 20, 60_000)) {
          ws.close();
        }
        return;
      }
      meta.playerId = player.id;
      send(ws, social(player));
      const active = store.activeFor(player.id).find(
        (game) =>
          game.status === 'playing' &&
          game.seats.some(
            (seat) => seat.isYou && !seat.isBot && seat.connection !== 'abandoned',
          ),
      );
      if (active) {
        const game = store.games.get(active.id);
        const seat = game?.seats.find((row) => row.userId === player.id);
        if (game && seat && !seat.isBot && seat.connection !== 'abandoned') {
          restorePlayer(game, player.id);
          meta.gameId = game.id;
          broadcastGame(game);
        }
      }
      return;
    }
    const player = meta.playerId ? store.players.get(meta.playerId) : null;
    if (!player) {
      send(ws, { t: 'error', message: 'auth' });
      return;
    }
    if (message.t !== 'ping' && message.t !== 'reaction' && !store.rateOk(`ws:${player.id}`, 80, 10_000)) {
      send(ws, { t: 'error', message: 'rate-limit' });
      return;
    }
    if (message.t === 'ping') {
      store.touch(player.id);
      send(ws, { t: 'pong' });
      send(ws, social(player));
      return;
    }
    if (message.t === 'leave' || message.t === 'away') {
      const seated = meta.gameId ? store.games.get(meta.gameId) : null;
      if (seated) {
        const ended = parkPlayer(seated, player.id, message.t === 'leave');
        store.cancelSeatSwitches(seated, player.id);
        meta.gameId = null;
        afterPark(seated, ended);
        if (!ended) {
          pushPlayer(player.id, social(player));
        }
      }
      return;
    }
    if (message.t === 'watch' && typeof message.gameId === 'string') {
      const game = store.games.get(message.gameId);
      if (!game || game.status === 'complete') {
        send(ws, { t: 'error', message: 'session-expired' });
        return;
      }
      if (!game.seats.some((seat) => seat.userId === player.id)) {
        send(ws, { t: 'error', message: 'forbidden' });
        return;
      }
      restorePlayer(game, player.id);
      meta.gameId = game.id;
      store.save();
      broadcastGame(game);
      return;
    }
    const game = meta.gameId ? store.games.get(meta.gameId) : null;
    if (message.t === 'intent' && game) {
      if (store.remember(game, player.id, typeof message.id === 'string' ? message.id : undefined)) {
        return;
      }
      try {
        applyUserIntent(game, player.id, {
          kind: message.kind as 'play' | 'pass' | 'exchange' | 'nextHand' | 'playAgain' | 'ability',
          cards: Array.isArray(message.cards) ? (message.cards as string[]) : undefined,
          cardId: typeof message.cardId === 'string' ? message.cardId : undefined,
          intoCardId: typeof message.intoCardId === 'string' ? message.intoCardId : undefined,
          abilityId: typeof message.abilityId === 'string' ? (message.abilityId as import('../src/domain').ChaosAbilityId) : undefined,
          targetSeat:
            message.targetSeat === 0 || message.targetSeat === 1 || message.targetSeat === 2 || message.targetSeat === 3
              ? message.targetSeat
              : undefined,
        });
        store.save();
        broadcastGame(game);
        schedule(game);
      } catch (error) {
        send(ws, { t: 'error', message: error instanceof Error ? error.message : 'illegal' });
      }
      return;
    }
    if (message.t === 'chat' && game) {
      try {
        const line = store.chat(game, player, String(message.text ?? ''));
        if (line) {
          for (const peer of gameSockets(game)) {
            send(peer, { t: 'chat', ...line });
          }
        }
      } catch (error) {
        send(ws, { t: 'error', message: error instanceof Error ? error.message : 'chat' });
      }
      return;
    }
    if (message.t === 'reaction' && game) {
      // Broadcast only. Do not write reactions to the store, chat, or disk.
      const result = reactions.submit({
        now: Date.now(),
        room: {
          id: game.id,
          status: game.status,
          occupants: occupantsOfSeats(game.id, game.seats),
        },
        senderId: player.id,
        requestId: String(message.requestId ?? ''),
        reactionId: String(message.reactionId ?? ''),
        targetPlayerId: String(message.targetPlayerId ?? ''),
      });
      if (!result.ok) {
        send(ws, {
          t: 'reactionDenied',
          requestId: String(message.requestId ?? ''),
          reason: result.reason,
          retryAfterMs: result.retryAfterMs,
        });
        return;
      }
      for (const peer of gameSockets(game)) {
        send(peer, { t: 'reaction', ...result.event });
      }
      return;
    }
    if ((message.t === 'mute' || message.t === 'speaking' || message.t === 'voiceStatus') && game) {
      const seat = game.seats.find((row) => row.userId === player.id);
      if (!seat) {
        return;
      }
      if (message.t === 'mute') {
        seat.muted = Boolean(message.muted);
      }
      if (message.t === 'speaking') {
        seat.speaking = Boolean(message.on) && !seat.muted;
      }
      if (message.t === 'voiceStatus') {
        seat.voiceAvailable = Boolean(message.available);
      }
      broadcastGame(game);
      return;
    }
  });

  function relayVoice(from: WebSocket, frame: Uint8Array) {
    const meta = sockets.get(from);
    const player = meta?.playerId ? store.players.get(meta.playerId) : null;
    if (!meta || !player) {
      return;
    }
    if (!store.rateOk(`voice:${player.id}`, 80, 1000)) {
      return;
    }
    const parsed = decodeVoiceFrame(frame);
    if (!parsed) {
      return;
    }
    const game = meta.gameId ? store.games.get(meta.gameId) : null;
    if (!game) {
      return;
    }
    const seat = game.seats.findIndex((row) => row.userId === player.id);
    const occupant = seat >= 0 ? game.seats[seat] : null;
    if (!occupant || occupant.muted) {
      return;
    }
    const stamped = stampVoiceSeat(frame, seat);
    for (const peer of gameSockets(game)) {
      if (peer !== from) {
        sendBytes(peer, stamped);
      }
    }
  }

  ws.on('error', () => undefined);

  ws.on('close', () => {
    const meta = sockets.get(ws);
    sockets.delete(ws);
    socketIps.delete(ws);
    if (meta?.playerId && meta.gameId) {
      const remaining = [...sockets.values()].some((row) => row.playerId === meta.playerId);
      if (!remaining) {
        const game = store.games.get(meta.gameId);
        if (game) {
          afterPark(game, parkPlayer(game, meta.playerId, false));
        }
      }
    }
  });
});

async function boot() {
  if (DATABASE_URL) {
    persistence = await openPostgres(DATABASE_URL);
    if (persistence.initial) {
      store.restore(persistence.initial);
    }
    console.log(`Murlan state loaded from Postgres (${store.players.size} players, ${store.games.size} games)`);
  }
  store.prune();
  setInterval(() => store.prune(), 60 * 60 * 1000).unref();

  for (const game of store.games.values()) {
    if (game.status === 'playing') {
      schedule(game);
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Murlan platform http://127.0.0.1:${PORT}`);
    const addresses = Object.values(networkInterfaces())
      .flat()
      .flatMap((item) => (item && item.family === 'IPv4' && !item.internal ? [item.address] : []));
    for (const address of addresses) {
      console.log(`Murlan platform ws://${address}:${PORT}`);
    }
  });
}

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) {
    return;
  }
  stopping = true;
  console.log(`${signal}: saving and closing`);
  for (const game of store.games.values()) {
    stopGame(game);
  }
  wss.clients.forEach((ws) => ws.close(1012, 'restarting'));
  httpServer.close();
  try {
    store.save();
    await persistence?.flush();
  } catch (error) {
    console.error('final save failed', error);
  }
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

boot().catch((error) => {
  console.error('boot failed', error);
  process.exit(1);
});
