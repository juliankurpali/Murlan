import { MatchMode } from '../domain';
import { withAiLabel } from '../platform/ids';
import { ConnectionState } from './lifecycle';

export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type RoomSeat = {
  name: string;
  ready: boolean;
  lobbyReady: boolean;
  isHost: boolean;
  isBot: boolean;
  isYou: boolean;
  muted: boolean;
  speaking: boolean;
  voiceAvailable: boolean;
  connection: ConnectionState;
  playerId: string | null;
};

export type GameRoom = {
  id: string;
  code: string;
  host: boolean;
  started: boolean;
  mode: MatchMode;
  seats: RoomSeat[];
  pendingJoins?: { fromId: string; username: string }[];
};

export function emptyRoomSeat(): RoomSeat {
  return occupant('Empty', { ready: false, voiceAvailable: false, connection: 'abandoned', lobbyReady: false });
}

export function seatsForMode(mode: MatchMode, seats: RoomSeat[]): RoomSeat[] {
  const count = mode === 'super' ? 6 : 4;
  if (seats.length === count) {
    return seats;
  }
  if (seats.length < count) {
    return seats.concat(Array.from({ length: count - seats.length }, () => emptyRoomSeat()));
  }
  return seats.slice(0, count);
}

function occupant(name: string, options: Partial<RoomSeat> = {}): RoomSeat {
  return {
    name,
    ready: options.ready ?? true,
    lobbyReady: options.lobbyReady ?? Boolean(options.isHost || options.isBot),
    isHost: options.isHost ?? false,
    isBot: options.isBot ?? false,
    isYou: options.isYou ?? false,
    muted: options.muted ?? true,
    speaking: options.speaking ?? false,
    voiceAvailable: options.voiceAvailable ?? true,
    connection: options.connection ?? 'connected',
    playerId: options.playerId ?? null,
  };
}

export function createRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? 'A';
  }
  return code;
}

const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{4}$`);

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isRoomCode(value: string): boolean {
  return CODE_PATTERN.test(normalizeRoomCode(value));
}

export function roomIsReady(room: GameRoom): boolean {
  const needed = room.mode === 'super' ? 6 : 4;
  return room.seats.length === needed && room.seats.every((seat) => seat.ready);
}

export function guestsAreReady(room: GameRoom): boolean {
  return room.seats.every((seat) => !seat.ready || seat.isBot || seat.isHost || seat.lobbyReady);
}

export function waitingReadyNames(room: GameRoom): string[] {
  return room.seats
    .filter((seat) => seat.ready && !seat.isBot && !seat.isHost && !seat.lobbyReady)
    .map((seat) => seat.name);
}

export function localSeatOf(room: GameRoom | null): number {
  const index = room?.seats.findIndex((seat) => seat.isYou) ?? 0;
  return index >= 0 ? index : 0;
}

export function botSeatsOf(room: GameRoom | null): number[] {
  if (!room) {
    return [1, 2, 3];
  }
  return room.seats.flatMap((seat, index) => (seat.isBot ? [index] : []));
}

export type TableSide = 'south' | 'west' | 'north' | 'east' | 'northwest' | 'northeast' | 'southwest' | 'southeast';

export function tableSeat(localSeat: number, side: TableSide, seatCount = 4): number {
  const offset =
    seatCount === 6
      ? { south: 0, southwest: 1, northwest: 2, north: 3, northeast: 4, southeast: 5, west: 1, east: 5 }[side]
      : { south: 0, west: 1, north: 2, east: 3, northwest: 2, northeast: 2, southwest: 1, southeast: 3 }[side];
  return (localSeat + offset) % seatCount;
}

export function hostRoom(playerName: string): GameRoom {
  return {
    id: '',
    code: createRoomCode(),
    host: true,
    started: false,
    mode: '2v2',
    seats: [
      occupant(playerName, { isYou: true, isHost: true, lobbyReady: true }),
      occupant('Empty', { ready: false, voiceAvailable: false, connection: 'abandoned' }),
      occupant('Empty', { ready: false, voiceAvailable: false, connection: 'abandoned' }),
      occupant('Empty', { ready: false, voiceAvailable: false, connection: 'abandoned' }),
    ],
  };
}

export function joinRoom(code: string, playerName: string): GameRoom {
  return {
    id: '',
    code: normalizeRoomCode(code),
    host: false,
    started: false,
    mode: '2v2',
    seats: [
      occupant('Host', { isHost: true, lobbyReady: true }),
      occupant(playerName, { isYou: true }),
      occupant('Empty', { ready: false, voiceAvailable: false, connection: 'abandoned' }),
      occupant('Empty', { ready: false, voiceAvailable: false, connection: 'abandoned' }),
    ],
  };
}

export function fillBots(room: GameRoom, names: string[]): GameRoom {
  let bot = 0;
  const seats = room.seats.map((seat) => {
    if (seat.ready) {
      return seat;
    }
    const name = withAiLabel(names[bot] ?? `Bot ${bot + 1}`);
    bot += 1;
    return occupant(name, { isBot: true, muted: true, voiceAvailable: false });
  });
  return { ...room, seats };
}
