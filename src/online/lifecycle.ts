export const HEARTBEAT_MS = 10_000;
export const HEARTBEAT_MISS_LIMIT = 3;
export const HEARTBEAT_TIMEOUT_MS = HEARTBEAT_MS * HEARTBEAT_MISS_LIMIT;
export const RECONNECT_GRACE_MS = 60_000;
export const INTENT_ID_CAP = 32;

/** Disconnected seats keep the existing 20s host auto-act; the table does not pause. */
export const DISCONNECT_TURN_POLICY = 'auto-act' as const;

export type ConnectionState =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'restoring'
  | 'failed'
  | 'abandoned';

export type LiveSeat = {
  name: string;
  ready: boolean;
  isBot: boolean;
  muted: boolean;
  speaking: boolean;
  voiceAvailable: boolean;
  playerId: string | null;
  playerKey: string | null;
  resumeToken: string | null;
  connection: ConnectionState;
  lastPing: number;
  disconnectedAt: number | null;
  seenIntents: string[];
};

export function createResumeToken(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function isPlayerKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

export function humanSeat(seat: LiveSeat | null | undefined): seat is LiveSeat {
  return Boolean(seat && seat.ready && !seat.isBot);
}

export function unexpectedDisconnect(seat: LiveSeat, now: number): LiveSeat {
  if (seat.isBot) {
    return seat;
  }
  return {
    ...seat,
    playerId: null,
    speaking: false,
    connection: 'disconnected',
    disconnectedAt: now,
  };
}

export function beginRestore(seat: LiveSeat): LiveSeat {
  return {
    ...seat,
    connection: 'restoring',
    speaking: false,
  };
}

export function completeRestore(seat: LiveSeat, playerId: string, now: number): LiveSeat {
  return {
    ...seat,
    playerId,
    connection: 'connected',
    lastPing: now,
    disconnectedAt: null,
    speaking: false,
  };
}

export function replaceConnectedSession(seat: LiveSeat, playerId: string, now: number): LiveSeat {
  return completeRestore(seat, playerId, now);
}

export function abandonSeat(seat: LiveSeat): LiveSeat {
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

export function shouldAbandon(seat: LiveSeat, now: number, graceMs = RECONNECT_GRACE_MS): boolean {
  return (
    !seat.isBot &&
    (seat.connection === 'disconnected' || seat.connection === 'failed' || seat.connection === 'reconnecting') &&
    typeof seat.disconnectedAt === 'number' &&
    now - seat.disconnectedAt >= graceMs
  );
}

export function missedHeartbeat(seat: LiveSeat, now: number, timeoutMs = HEARTBEAT_TIMEOUT_MS): boolean {
  return humanSeat(seat) && seat.connection === 'connected' && now - seat.lastPing >= timeoutMs;
}

export function findSeatByPlayerKey(seats: Array<LiveSeat | null>, playerKey: string): number {
  return seats.findIndex((seat) => seat?.playerKey === playerKey);
}

export function resumeTarget(
  seats: Array<LiveSeat | null>,
  playerKey: string,
  token: string,
): { index: number; error?: undefined } | { index: -1; error: 'session-expired' | 'seat-taken' } {
  const index = findSeatByPlayerKey(seats, playerKey);
  const seat = index >= 0 ? seats[index] : null;
  if (!seat || seat.isBot || seat.connection === 'abandoned' || seat.resumeToken !== token) {
    return { index: -1, error: 'session-expired' };
  }
  return { index };
}

export function rememberIntent(seen: readonly string[], id: string | undefined, cap = INTENT_ID_CAP): {
  duplicate: boolean;
  seen: string[];
} {
  if (!id) {
    return { duplicate: false, seen: [...seen] };
  }
  if (seen.includes(id)) {
    return { duplicate: true, seen: [...seen] };
  }
  return { duplicate: false, seen: [...seen, id].slice(-cap) };
}

export function actingHostId(seats: Array<LiveSeat | null>, currentHostId: string | null): string | null {
  const connected = seats
    .filter(humanSeat)
    .filter((seat) => seat.connection === 'connected' && seat.playerId);
  const current = connected.find((seat) => seat.playerId === currentHostId);
  if (current?.playerId) {
    return current.playerId;
  }
  return connected[0]?.playerId ?? null;
}
