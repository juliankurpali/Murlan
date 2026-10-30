import { GameState, MatchMode, PublicMatchView, SeatId } from '../domain';
import { Friendship, GameSummary, PlatformNotice, PublicPlayer } from '../platform/types';
import { ChatMessage } from './chat';
import { ConnectionState } from './lifecycle';
import { GameRoom, RoomSeat } from './room';

export type RelaySeat = {
  name: string;
  ready: boolean;
  lobbyReady?: boolean;
  isBot: boolean;
  muted: boolean;
  speaking: boolean;
  voiceAvailable: boolean;
  connection: ConnectionState;
  playerId: string | null;
};

export type RelayRoom = {
  id?: string;
  code: string;
  hostId: string;
  started: boolean;
  mode?: MatchMode;
  seats: (RelaySeat | null)[];
  pendingJoins?: { fromId: string; username: string }[];
};

export type ClientMessage =
  | { t: 'auth'; token: string }
  | { t: 'identify'; playerKey: string }
  | { t: 'watch'; gameId: string }
  | { t: 'host'; name: string; playerKey: string }
  | { t: 'join'; code: string; name: string; playerKey: string }
  | { t: 'resume'; code: string; playerKey: string; token: string }
  | { t: 'leave' }
  | { t: 'away' }
  | { t: 'ping' }
  | { t: 'fillBots'; names: string[] }
  | { t: 'start'; mode: MatchMode }
  | { t: 'state'; match: GameState }
  | {
      t: 'intent';
      id?: string;
      kind: 'play' | 'pass' | 'exchange' | 'nextHand';
      cards?: string[];
      cardId?: string;
    }
  | { t: 'mute'; muted: boolean }
  | { t: 'speaking'; on: boolean }
  | { t: 'voiceStatus'; available: boolean }
  | { t: 'voice'; pcm: string; rate?: number }
  | { t: 'chat'; text: string };

export type ServerMessage =
  | { t: 'hello'; id?: string }
  | { t: 'pong' }
  | { t: 'session'; code: string; token: string; seat: SeatId }
  | { t: 'room'; room: RelayRoom }
  | { t: 'started'; mode: MatchMode }
  | { t: 'state'; match: GameState }
  | { t: 'view'; gameId: string; code: string; seat: SeatId; view: PublicMatchView; legalCardIds: string[]; humanTurn: boolean; nextHandReady?: SeatId[] }
  | { t: 'social'; me: PublicPlayer; friends: PublicPlayer[]; requests: Friendship[]; inbox: PlatformNotice[]; games: GameSummary[] }
  | {
      t: 'intent';
      seat: SeatId;
      id?: string;
      kind: 'play' | 'pass' | 'exchange' | 'nextHand';
      cards?: string[];
      cardId?: string;
    }
  | { t: 'voice'; seat: SeatId; pcm: string; rate?: number }
  | { t: 'chat'; id: string; seat: SeatId; name: string; text: string; at: number }
  | { t: 'chatHistory'; messages: ChatMessage[] }
  | { t: 'ended'; gameId: string }
  | { t: 'error'; message: string };

function emptySeatView(): RoomSeat {
  return {
    name: 'Empty',
    ready: false,
    lobbyReady: false,
    isHost: false,
    isBot: false,
    isYou: false,
    muted: true,
    speaking: false,
    voiceAvailable: false,
    connection: 'abandoned',
  };
}

export function toGameRoom(snapshot: RelayRoom, myId: string | null): GameRoom {
  const seats: RoomSeat[] = [0, 1, 2, 3].map((index) => {
    const seat = snapshot.seats[index];
    if (!seat) {
      return emptySeatView();
    }
    return {
      name: seat.name,
      ready: seat.ready,
      lobbyReady: Boolean(seat.lobbyReady || seat.isBot || seat.playerId === snapshot.hostId),
      isHost: Boolean(seat.playerId && seat.playerId === snapshot.hostId),
      isBot: seat.isBot,
      isYou: Boolean(myId && seat.playerId === myId),
      muted: seat.muted,
      speaking: seat.speaking,
      voiceAvailable: seat.voiceAvailable !== false,
      connection: seat.connection ?? 'connected',
    };
  });
  return {
    id: snapshot.id ?? snapshot.code,
    code: snapshot.code,
    host: snapshot.hostId === myId,
    started: snapshot.started,
    mode: snapshot.mode ?? '2v2',
    seats,
    pendingJoins: snapshot.pendingJoins ?? [],
  };
}
