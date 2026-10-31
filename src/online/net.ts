import { SeatId } from '../domain';
import { Friendship, GameSummary, PlatformNotice, PublicPlayer, TablePayload } from '../platform/types';
import { ChatMessage } from './chat';
import { HEARTBEAT_MS } from './lifecycle';
import { ClientMessage, ServerMessage, toGameRoom } from './protocol';
import { relayUrls } from './relayUrl';
import { GameRoom } from './room';

export type NetStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'restoring' | 'failed' | 'down';

export type SocialPayload = {
  me: PublicPlayer;
  friends: PublicPlayer[];
  requests: Friendship[];
  inbox: PlatformNotice[];
  games: GameSummary[];
};

type Handlers = {
  onRoom?: (room: GameRoom) => void;
  onView?: (table: TablePayload) => void;
  onSocial?: (social: SocialPayload) => void;
  onVoice?: (seat: SeatId, pcm: string, rate?: number) => void;
  onChat?: (message: ChatMessage) => void;
  onChatHistory?: (messages: ChatMessage[]) => void;
  onEnded?: (gameId: string, reason?: 'admin' | 'empty', code?: string) => void;
  onError?: (message: string) => void;
  onStatus?: (status: NetStatus) => void;
};

let socket: WebSocket | null = null;
let myId: string | null = null;
let handlers: Handlers = {};
let status: NetStatus = 'idle';
let helloWait: ((id: string) => void) | null = null;
let sessionToken: string | null = null;
let watchGameId: string | null = null;
let stayConnected = false;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

function setStatus(next: NetStatus) {
  status = next;
  handlers.onStatus?.(next);
}

function send(message: ClientMessage) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function stopPing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function startPing() {
  stopPing();
  pingTimer = setInterval(() => send({ t: 'ping' }), HEARTBEAT_MS);
}

function authenticate() {
  if (sessionToken) {
    send({ t: 'auth', token: sessionToken });
  }
}

function handle(message: ServerMessage) {
  if (message.t === 'hello') {
    if (typeof message.id === 'string' && message.id !== 'ok') {
      myId = message.id;
    }
    helloWait?.(myId ?? 'self');
    helloWait = null;
    authenticate();
    return;
  }
  if (message.t === 'pong') {
    return;
  }
  if (message.t === 'social') {
    myId = message.me.id;
    handlers.onSocial?.(message);
    return;
  }
  if (message.t === 'room') {
    if (!watchGameId || (message.room.id && message.room.id !== watchGameId)) {
      return;
    }
    handlers.onRoom?.(toGameRoom(message.room, myId));
    return;
  }
  if (message.t === 'view') {
    if (!watchGameId || message.gameId !== watchGameId) {
      return;
    }
    handlers.onView?.({
      gameId: message.gameId,
      code: message.code,
      seat: message.seat,
      view: message.view,
      legalCardIds: message.legalCardIds,
      humanTurn: message.humanTurn,
      nextHandReady: message.nextHandReady ?? [],
    });
    return;
  }
  if (message.t === 'voice') {
    handlers.onVoice?.(message.seat, message.pcm, message.rate);
    return;
  }
  if (message.t === 'chat') {
    handlers.onChat?.({
      id: message.id,
      seat: message.seat,
      name: message.name,
      text: message.text,
      at: message.at,
    });
    return;
  }
  if (message.t === 'chatHistory') {
    handlers.onChatHistory?.(message.messages);
    return;
  }
  if (message.t === 'ended') {
    handlers.onEnded?.(message.gameId, message.reason, message.code);
    return;
  }
  if (message.t === 'error') {
    handlers.onError?.(message.message);
  }
}

export function bindNet(next: Handlers) {
  handlers = next;
}

export function netStatus(): NetStatus {
  return status;
}

export function netId(): string | null {
  return myId;
}

export function setSessionToken(next: string | null) {
  sessionToken = next;
}

export function setWatchGame(gameId: string | null) {
  watchGameId = gameId;
}

function tryUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const candidate = new WebSocket(url);
    candidate.onmessage = (event) => {
      try {
        handle(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        /* ignore */
      }
    };
    candidate.onclose = () => {
      if (socket === candidate) {
        socket = null;
        stopPing();
        if (stayConnected) {
          scheduleReconnect();
        } else if (status !== 'idle') {
          setStatus('down');
        }
      }
    };
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        candidate.close();
        resolve(false);
      }
    }, 1800);
    candidate.onopen = () => {
      if (settled) {
        candidate.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket = candidate;
      resolve(true);
    };
    candidate.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        candidate.close();
        resolve(false);
      }
    };
  });
}

function scheduleReconnect() {
  if (reconnectTimer || !stayConnected) {
    return;
  }
  setStatus('reconnecting');
  const delay = Math.min(8000, 400 * 2 ** reconnectAttempt);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void reconnectNow();
  }, delay);
}

async function reconnectNow() {
  if (!stayConnected) {
    return;
  }
  reconnectAttempt += 1;
  const opened = await openSocket();
  if (!opened) {
    if (reconnectAttempt > 8) {
      setStatus('failed');
    }
    scheduleReconnect();
    return;
  }
  reconnectAttempt = 0;
  await waitForHello();
  startPing();
  authenticate();
  if (watchGameId) {
    setStatus('restoring');
    send({ t: 'watch', gameId: watchGameId });
  }
  setStatus('live');
}

async function openSocket(): Promise<boolean> {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return true;
  }
  const urls = relayUrls();
  for (const url of urls) {
    const opened = await tryUrl(url);
    if (opened) {
      return true;
    }
  }
  return false;
}

export async function connectNet(): Promise<void> {
  stayConnected = true;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    authenticate();
    return;
  }
  setStatus('connecting');
  const opened = await openSocket();
  if (opened) {
    reconnectAttempt = 0;
    setStatus('live');
    startPing();
    authenticate();
    return;
  }
  setStatus('down');
  scheduleReconnect();
}

function waitForHello(): Promise<string> {
  if (myId) {
    return Promise.resolve(myId);
  }
  return new Promise((resolve) => {
    helloWait = resolve;
  });
}

export function disconnectNet() {
  stayConnected = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopPing();
  watchGameId = null;
  helloWait = null;
  socket?.close();
  socket = null;
  setStatus('idle');
}

export function watchTable(gameId: string) {
  watchGameId = gameId;
  void connectNet()
    .then(() => waitForHello())
    .then(() => send({ t: 'watch', gameId }));
}

export function sendLeave() {
  send({ t: 'leave' });
  watchGameId = null;
}

export function sendAway() {
  send({ t: 'away' });
  watchGameId = null;
}

export function sendIntent(
  kind: 'play' | 'pass' | 'exchange' | 'nextHand',
  payload?: { cards?: string[]; cardId?: string },
) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  send({ t: 'intent', id, kind, cards: payload?.cards, cardId: payload?.cardId });
}

export function sendMute(muted: boolean) {
  send({ t: 'mute', muted });
}

export function sendSpeaking(on: boolean) {
  send({ t: 'speaking', on });
}

export function sendVoiceStatus(available: boolean) {
  send({ t: 'voiceStatus', available });
}

export function sendVoice(pcm: string, rate?: number) {
  send({ t: 'voice', pcm, rate });
}

export function sendChat(text: string) {
  send({ t: 'chat', text });
}

export function currentRoomCode(): string | null {
  return watchGameId;
}
