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

export function isRoomCode(value: string): boolean {
  return CODE_PATTERN.test(value.trim().toUpperCase());
}

export function roomIsReady(room: GameRoom): boolean {
  return room.seats.length === 4 && room.seats.every((seat) => seat.ready);
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

export function tableSeat(localSeat: number, side: 'south' | 'west' | 'north' | 'east'): number {
  const offset = { south: 0, west: 1, north: 2, east: 3 }[side];
  return (localSeat + offset) % 4;
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
    code: code.trim().toUpperCase(),
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
