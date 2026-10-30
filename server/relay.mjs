import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.MURLAN_RELAY_PORT ?? 8787);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const HEARTBEAT_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const RECONNECT_GRACE_MS = 60_000;
const INTENT_ID_CAP = 32;
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const STATE_PATH = join(DATA_DIR, 'rooms.json');

/** @typedef {'connected' | 'disconnected' | 'reconnecting' | 'restoring' | 'failed' | 'abandoned'} ConnectionState */
/** @typedef {{ name: string, ready: boolean, isBot: boolean, muted: boolean, speaking: boolean, voiceAvailable: boolean, playerId: string | null, playerKey: string | null, resumeToken: string | null, connection: ConnectionState, lastPing: number, disconnectedAt: number | null, seenIntents: string[] }} Seat */
/** @typedef {{ id: string, seat: number, name: string, text: string, at: number }} ChatLine */
/** @typedef {{ code: string, hostId: string, started: boolean, match: object | null, seats: (Seat | null)[], chat: ChatLine[] }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();
/** @type {Map<import('ws').WebSocket, { id: string, code: string | null, playerKey: string | null, lastPing: number }>} */
const clients = new Map();

function now() {
  return Date.now();
}

function createCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < 4; i += 1) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? 'A';
    }
    if (!rooms.has(code)) {
      return code;
    }
  }
  return `${ALPHABET[0]}${Date.now().toString(36).slice(-3)}`.toUpperCase().slice(0, 4);
}

function createToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function isPlayerKey(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

function emptySeat() {
  return null;
}

function occupy(name, playerId, playerKey) {
  return {
    name: String(name ?? 'Player').slice(0, 24),
    ready: true,
    isBot: false,
    muted: true,
    speaking: false,
    voiceAvailable: true,
    playerId,
    playerKey: isPlayerKey(playerKey) ? playerKey : null,
    resumeToken: createToken(),
    connection: 'connected',
    lastPing: now(),
    disconnectedAt: null,
    seenIntents: [],
  };
}

function publicSeat(seat) {
  if (!seat) {
    return null;
  }
  return {
    name: seat.name,
    ready: seat.ready,
    isBot: seat.isBot,
    muted: seat.muted,
    speaking: seat.speaking,
    voiceAvailable: seat.voiceAvailable !== false,
    connection: seat.connection,
    playerId: seat.playerId,
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    seats: room.seats.map(publicSeat),
  };
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(room, payload, exceptId) {
  for (const [socket, meta] of clients) {
    if (meta.code !== room.code || meta.id === exceptId) {
      continue;
    }
    send(socket, payload);
  }
}

function seatIndexFor(room, playerId) {
  return room.seats.findIndex((seat) => seat?.playerId === playerId);
}

function findByPlayerKey(playerKey) {
  if (!playerKey) {
    return null;
  }
  for (const room of rooms.values()) {
    const index = room.seats.findIndex((seat) => seat?.playerKey === playerKey && !seat.isBot);
    if (index >= 0) {
      return { room, index, seat: room.seats[index] };
    }
  }
  return null;
}

function socketForId(playerId) {
  for (const [socket, meta] of clients) {
    if (meta.id === playerId) {
      return socket;
    }
  }
  return null;
}

function persistSoon() {
  persistSoon.handle = persistSoon.handle ?? setTimeout(() => {
    persistSoon.handle = null;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(STATE_PATH, JSON.stringify({ rooms: [...rooms.values()] }));
    } catch {
      /* disk may be unavailable */
    }
  }, 250);
}

function restoreRooms() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    const saved = Array.isArray(parsed?.rooms) ? parsed.rooms : [];
    const stamp = now();
    for (const room of saved) {
      if (!room?.code || !Array.isArray(room.seats)) {
        continue;
      }
      room.seats = room.seats.map((seat) => {
        if (!seat || seat.isBot) {
          return seat ?? null;
        }
        return {
          ...seat,
          playerId: null,
          speaking: false,
          connection: 'disconnected',
          disconnectedAt: seat.disconnectedAt ?? stamp,
          seenIntents: Array.isArray(seat.seenIntents) ? seat.seenIntents : [],
        };
      });
      rooms.set(room.code, room);
    }
  } catch {
    /* first boot or empty state */
  }
}

function promoteHost(room) {
  const connected = room.seats.find((seat) => seat && !seat.isBot && seat.connection === 'connected' && seat.playerId);
  if (connected?.playerId) {
    room.hostId = connected.playerId;
  }
}

function snapshotTo(ws, room) {
  send(ws, { t: 'room', room: publicRoom(room) });
  send(ws, { t: 'chatHistory', messages: room.chat ?? [] });
  if (room.started && room.match) {
    send(ws, { t: 'state', match: room.match });
  }
}

function attachSeat(ws, room, index, name, playerKey) {
  const meta = clients.get(ws);
  if (!meta) {
    return;
  }
  const previous = socketForId(room.seats[index]?.playerId);
  if (previous && previous !== ws) {
    send(previous, { t: 'error', message: 'replaced' });
    const prevMeta = clients.get(previous);
    if (prevMeta) {
      prevMeta.code = null;
    }
    previous.close();
  }
  const seat = occupy(name ?? room.seats[index]?.name ?? 'Player', meta.id, playerKey);
  if (room.seats[index]?.resumeToken && room.seats[index]?.playerKey === playerKey) {
    seat.resumeToken = room.seats[index].resumeToken;
    seat.name = room.seats[index].name;
    seat.muted = room.seats[index].muted;
    seat.seenIntents = room.seats[index].seenIntents;
  }
  room.seats[index] = seat;
  meta.code = room.code;
  meta.playerKey = playerKey;
  send(ws, { t: 'session', code: room.code, token: seat.resumeToken, seat: index });
  snapshotTo(ws, room);
  broadcast(room, { t: 'room', room: publicRoom(room) }, meta.id);
  persistSoon();
}

function restoreSeat(ws, room, index) {
  const meta = clients.get(ws);
  if (!meta) {
    return;
  }
  const current = room.seats[index];
  if (!current) {
    return;
  }
  const previous = socketForId(current.playerId);
  if (previous && previous !== ws) {
    send(previous, { t: 'error', message: 'replaced' });
    const prevMeta = clients.get(previous);
    if (prevMeta) {
      prevMeta.code = null;
    }
    previous.close();
  }
  current.playerId = meta.id;
  current.connection = 'connected';
  current.lastPing = now();
  current.disconnectedAt = null;
  current.speaking = false;
  current.isBot = false;
  current.ready = true;
  meta.code = room.code;
  meta.playerKey = current.playerKey;
  if (!room.seats.some((seat) => seat?.playerId === room.hostId && seat.connection === 'connected')) {
    promoteHost(room);
  }
  send(ws, { t: 'session', code: room.code, token: current.resumeToken, seat: index });
  snapshotTo(ws, room);
  broadcast(room, { t: 'room', room: publicRoom(room) }, meta.id);
  persistSoon();
}

function abandon(seat) {
  return {
    ...seat,
    isBot: true,
    playerId: null,
    playerKey: null,
    resumeToken: null,
    connection: 'abandoned',
    disconnectedAt: null,
    speaking: false,
    muted: true,
    voiceAvailable: false,
    ready: true,
  };
}

function parkSeat(seat) {
  return {
    ...seat,
    playerId: null,
    speaking: false,
    connection: 'disconnected',
    disconnectedAt: now(),
  };
}

function dropRoomIfEmpty(room) {
  const humans = room.seats.filter((seat) => seat && !seat.isBot && seat.connection !== 'abandoned');
  if (humans.length === 0) {
    rooms.delete(room.code);
    persistSoon();
  }
}

function leave(ws, intentional) {
  const meta = clients.get(ws);
  if (!meta) {
    return;
  }
  const room = meta.code ? rooms.get(meta.code) : null;
  if (room) {
    const index = seatIndexFor(room, meta.id);
    if (index >= 0 && room.seats[index]) {
      if (intentional || !room.started) {
        room.seats[index] = room.started ? abandon(room.seats[index]) : emptySeat();
      } else {
        room.seats[index] = parkSeat(room.seats[index]);
      }
    }
    const remaining = [...clients.values()].filter((item) => item.code === room.code && item.id !== meta.id);
    if (remaining.length === 0 && (!room.started || intentional)) {
      rooms.delete(room.code);
    } else {
      if (room.hostId === meta.id) {
        promoteHost(room);
      }
      broadcast(room, { t: 'room', room: publicRoom(room) });
      dropRoomIfEmpty(room);
    }
    persistSoon();
  }
  meta.code = null;
}

function sweep() {
  const stamp = now();
  for (const room of rooms.values()) {
    let changed = false;
    room.seats = room.seats.map((seat) => {
      if (!seat || seat.isBot) {
        return seat;
      }
      if (seat.connection === 'connected' && stamp - seat.lastPing >= HEARTBEAT_TIMEOUT_MS) {
        changed = true;
        return parkSeat(seat);
      }
      if (
        (seat.connection === 'disconnected' || seat.connection === 'failed' || seat.connection === 'reconnecting') &&
        seat.disconnectedAt &&
        stamp - seat.disconnectedAt >= RECONNECT_GRACE_MS
      ) {
        changed = true;
        return abandon(seat);
      }
      return seat;
    });
    if (changed) {
      if (room.hostId && !room.seats.some((seat) => seat?.playerId === room.hostId && seat.connection === 'connected')) {
        promoteHost(room);
      }
      broadcast(room, { t: 'room', room: publicRoom(room) });
      dropRoomIfEmpty(room);
      persistSoon();
    }
  }
}

restoreRooms();

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('murlan-relay');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2, 10);
  clients.set(ws, { id, code: null, playerKey: null, lastPing: now() });
  send(ws, { t: 'hello', id });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      send(ws, { t: 'error', message: 'bad-message' });
      return;
    }
    const meta = clients.get(ws);
    if (!meta) {
      return;
    }
    meta.lastPing = now();

    if (message.t === 'ping') {
      const room = meta.code ? rooms.get(meta.code) : null;
      const seat = room ? room.seats[seatIndexFor(room, meta.id)] : null;
      if (seat) {
        seat.lastPing = now();
      }
      send(ws, { t: 'pong' });
      return;
    }

    if (message.t === 'identify' && isPlayerKey(message.playerKey)) {
      meta.playerKey = message.playerKey;
      return;
    }

    if (message.t === 'leave') {
      leave(ws, true);
      return;
    }

    if (message.t === 'host') {
      const playerKey = isPlayerKey(message.playerKey) ? message.playerKey : meta.playerKey;
      const existing = findByPlayerKey(playerKey);
      if (existing && existing.room.started && existing.seat.connection !== 'abandoned') {
        restoreSeat(ws, existing.room, existing.index);
        return;
      }
      if (existing && !existing.room.started) {
        leave(socketForId(existing.seat.playerId) ?? ws, true);
      }
      const code = createCode();
      const room = {
        code,
        hostId: meta.id,
        started: false,
        match: null,
        chat: [],
        seats: [occupy(message.name ?? 'Host', meta.id, playerKey), emptySeat(), emptySeat(), emptySeat()],
      };
      rooms.set(code, room);
      meta.code = code;
      meta.playerKey = playerKey;
      send(ws, { t: 'session', code, token: room.seats[0].resumeToken, seat: 0 });
      send(ws, { t: 'room', room: publicRoom(room) });
      persistSoon();
      return;
    }

    if (message.t === 'resume') {
      const playerKey = isPlayerKey(message.playerKey) ? message.playerKey : meta.playerKey;
      const code = String(message.code ?? '')
        .trim()
        .toUpperCase();
      const room = rooms.get(code);
      const index = room ? room.seats.findIndex((seat) => seat?.playerKey === playerKey) : -1;
      const seat = index >= 0 ? room.seats[index] : null;
      if (!room || !seat || seat.isBot || seat.connection === 'abandoned' || seat.resumeToken !== String(message.token ?? '')) {
        send(ws, { t: 'error', message: 'session-expired' });
        return;
      }
      restoreSeat(ws, room, index);
      return;
    }

    if (message.t === 'join') {
      const playerKey = isPlayerKey(message.playerKey) ? message.playerKey : meta.playerKey;
      const code = String(message.code ?? '')
        .trim()
        .toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { t: 'error', message: 'room-missing' });
        return;
      }
      const existingIndex = room.seats.findIndex((seat) => seat?.playerKey === playerKey && !seat.isBot);
      if (existingIndex >= 0 && room.seats[existingIndex].connection !== 'abandoned') {
        restoreSeat(ws, room, existingIndex);
        return;
      }
      if (room.started) {
        send(ws, { t: 'error', message: 'room-started' });
        return;
      }
      const empty = room.seats.findIndex((seat) => !seat);
      const bot = room.seats.findIndex((seat) => seat?.isBot);
      const index = empty >= 0 ? empty : bot;
      if (index < 0) {
        send(ws, { t: 'error', message: 'room-full' });
        return;
      }
      attachSeat(ws, room, index, message.name, playerKey);
      return;
    }

    const room = meta.code ? rooms.get(meta.code) : null;
    if (!room) {
      send(ws, { t: 'error', message: 'not-in-room' });
      return;
    }
    const seat = seatIndexFor(room, meta.id);
    const occupant = seat >= 0 ? room.seats[seat] : null;
    if (occupant) {
      occupant.lastPing = now();
    }

    if (message.t === 'fillBots' && meta.id === room.hostId) {
      const names = Array.isArray(message.names) ? message.names : ['Leka', 'Drita', 'Gjergj'];
      let bot = 0;
      room.seats = room.seats.map((current) => {
        if (current?.ready) {
          return current;
        }
        const name = String(names[bot] ?? `Bot ${bot + 1}`);
        bot += 1;
        return {
          name,
          ready: true,
          isBot: true,
          muted: true,
          speaking: false,
          voiceAvailable: false,
          playerId: null,
          playerKey: null,
          resumeToken: null,
          connection: 'connected',
          lastPing: now(),
          disconnectedAt: null,
          seenIntents: [],
        };
      });
      broadcast(room, { t: 'room', room: publicRoom(room) });
      persistSoon();
      return;
    }

    if (message.t === 'start' && meta.id === room.hostId) {
      room.started = true;
      broadcast(room, { t: 'started', mode: message.mode ?? '2v2' });
      persistSoon();
      return;
    }

    if (message.t === 'state' && meta.id === room.hostId) {
      room.match = message.match ?? null;
      room.started = true;
      broadcast(room, { t: 'state', match: room.match }, meta.id);
      persistSoon();
      return;
    }

    if (message.t === 'intent' && occupant && occupant.connection === 'connected') {
      const intentId = typeof message.id === 'string' ? message.id : '';
      if (intentId) {
        if (occupant.seenIntents.includes(intentId)) {
          return;
        }
        occupant.seenIntents = [...occupant.seenIntents, intentId].slice(-INTENT_ID_CAP);
      }
      const hostSocket = socketForId(room.hostId);
      if (hostSocket) {
        send(hostSocket, {
          t: 'intent',
          seat,
          id: intentId || undefined,
          kind: message.kind,
          cards: message.cards,
          cardId: message.cardId,
        });
      }
      return;
    }

    if (message.t === 'mute' && occupant) {
      occupant.muted = Boolean(message.muted);
      if (message.muted) {
        occupant.speaking = false;
      }
      broadcast(room, { t: 'room', room: publicRoom(room) });
      return;
    }

    if (message.t === 'voiceStatus' && occupant) {
      occupant.voiceAvailable = Boolean(message.available);
      if (!occupant.voiceAvailable) {
        occupant.speaking = false;
      }
      broadcast(room, { t: 'room', room: publicRoom(room) });
      return;
    }

    if (message.t === 'speaking' && occupant) {
      occupant.speaking = Boolean(message.on) && !occupant.muted && occupant.voiceAvailable !== false;
      broadcast(room, { t: 'room', room: publicRoom(room) });
      return;
    }

    if (message.t === 'voice' && occupant && !occupant.muted && occupant.voiceAvailable !== false && occupant.connection === 'connected') {
      broadcast(room, { t: 'voice', seat, pcm: message.pcm, rate: message.rate }, meta.id);
      return;
    }

    if (message.t === 'chat' && occupant && !occupant.isBot && occupant.connection === 'connected') {
      const text = String(message.text ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140);
      if (!text) {
        return;
      }
      const line = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        seat,
        name: occupant.name,
        text,
        at: Date.now(),
      };
      room.chat = [...(room.chat ?? []), line].slice(-40);
      broadcast(room, { t: 'chat', ...line });
    }
  });

  ws.on('close', () => {
    leave(ws, false);
    clients.delete(ws);
  });
});

setInterval(sweep, 1000);

httpServer.listen(PORT, '0.0.0.0', () => {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
  console.log(`Murlan relay ws://127.0.0.1:${PORT}`);
  for (const address of addresses) {
    console.log(`Murlan relay ws://${address}:${PORT}`);
  }
});
