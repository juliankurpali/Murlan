import { ChaosAbilityId, SeatId } from '../domain';
import { Friendship, GameSummary, PlatformNotice, PublicPlayer, TablePayload } from '../platform/types';
import { ReactionEvent, ReactionId, ReactionReject } from '../reactions';
import { ChatMessage } from './chat';
import { HEARTBEAT_MS } from './lifecycle';
import { ClientMessage, ServerMessage, toGameRoom } from './protocol';
import { relayUrls } from './relayUrl';
import { GameRoom } from './room';
import { decodeVoiceFrame, type VoiceFrame } from './voiceFrame';

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
  onVoice?: (frame: VoiceFrame) => void;
  onChat?: (message: ChatMessage) => void;
  onChatHistory?: (messages: ChatMessage[]) => void;
  onReaction?: (event: ReactionEvent) => void;
  onReactionDenied?: (denied: { requestId: string; reason: ReactionReject['reason']; retryAfterMs?: number }) => void;
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

function sendBytes(bytes: Uint8Array) {
  if (!socket || socket.readyState !== WebSocket.OPEN || bytes.byteLength === 0) {
    return;
  }
  const buffer = bytes.buffer;
  if (bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength && buffer instanceof ArrayBuffer) {
    socket.send(buffer);
    return;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  socket.send(copy.buffer);
}

function handleBinary(data: ArrayBuffer | Blob | ArrayBufferView) {
  const consume = (buffer: ArrayBuffer) => {
    const frame = decodeVoiceFrame(new Uint8Array(buffer));
    if (frame) {
      handlers.onVoice?.(frame);
    }
  };
  if (data instanceof ArrayBuffer) {
    consume(data);
    return;
  }
  if (ArrayBuffer.isView(data)) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    consume(copy.buffer);
    return;
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    void data.arrayBuffer().then(consume).catch(() => undefined);
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
      playAgainReady: message.playAgainReady ?? [],
      series: message.series,
      chaos: message.chaos ?? null,
    });
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
  if (message.t === 'reaction') {
    handlers.onReaction?.({
      eventId: message.eventId,
      roomId: message.roomId,
      senderPlayerId: message.senderPlayerId,
      senderSeat: message.senderSeat,
      targetPlayerId: message.targetPlayerId,
      targetSeat: message.targetSeat,
      reactionId: message.reactionId,
      requestId: message.requestId,
      serverTimestamp: message.serverTimestamp,
    });
    return;
  }
  if (message.t === 'reactionDenied') {
    handlers.onReactionDenied?.({
      requestId: message.requestId,
      reason: message.reason as ReactionReject['reason'],
      retryAfterMs: message.retryAfterMs,
    });
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
    candidate.binaryType = 'arraybuffer';
    candidate.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        handleBinary(event.data as ArrayBuffer | Blob);
        return;
      }
      try {
        handle(JSON.parse(event.data) as ServerMessage);
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
  kind:
    | 'play'
    | 'pass'
    | 'exchange'
    | 'nextHand'
    | 'playAgain'
    | 'ability'
    | 'liesClaim'
    | 'liesBelieve'
    | 'liesChallenge'
    | 'liesClear',
  payload?: {
    cards?: string[];
    cardId?: string;
    intoCardId?: string;
    abilityId?: ChaosAbilityId;
    targetSeat?: SeatId;
    rank?: import('../domain').StandardRank;
  },
) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  send({
    t: 'intent',
    id,
    kind,
    cards: payload?.cards,
    cardId: payload?.cardId,
    intoCardId: payload?.intoCardId,
    abilityId: payload?.abilityId,
    targetSeat: payload?.targetSeat,
    rank: payload?.rank,
  });
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

export function sendVoice(frame: Uint8Array) {
  sendBytes(frame);
}

export function sendChat(text: string) {
  send({ t: 'chat', text });
}

export function sendReaction(reactionId: ReactionId, targetPlayerId: string) {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  send({ t: 'reaction', requestId, reactionId, targetPlayerId });
}

export function currentRoomCode(): string | null {
  return watchGameId;
}
