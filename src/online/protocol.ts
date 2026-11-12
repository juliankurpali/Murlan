import {
  ChaosAbilityId,
  GameState,
  MatchMode,
  PublicChaosView,
  PublicLiesView,
  PublicMatchView,
  SeatId,
  StandardRank,
} from '../domain';
import { Friendship, GameSummary, PlatformNotice, PublicPlayer, TableSeries } from '../platform/types';
import { ReactionId } from '../reactions';
import { ChatMessage } from './chat';
import { ConnectionState } from './lifecycle';
import { emptyRoomSeat, GameRoom, RoomSeat, seatsForMode } from './room';

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
  liesDeckCount?: 1 | 2;
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
        | 'liesClear';
      cards?: string[];
      cardId?: string;
      intoCardId?: string;
      abilityId?: ChaosAbilityId;
      targetSeat?: SeatId;
      rank?: StandardRank;
    }
  | { t: 'mute'; muted: boolean }
  | { t: 'speaking'; on: boolean }
  | { t: 'voiceStatus'; available: boolean }
  | { t: 'chat'; text: string }
  | { t: 'reaction'; requestId: string; reactionId: ReactionId; targetPlayerId: string };

export type ServerMessage =
  | { t: 'hello'; id?: string }
  | { t: 'pong' }
  | { t: 'session'; code: string; token: string; seat: SeatId }
  | { t: 'room'; room: RelayRoom }
  | { t: 'started'; mode: MatchMode }
  | { t: 'state'; match: GameState }
  | {
      t: 'view';
      gameId: string;
      code: string;
      seat: SeatId;
      view: PublicMatchView | PublicLiesView;
      legalCardIds: string[];
      humanTurn: boolean;
      nextHandReady?: SeatId[];
      playAgainReady?: SeatId[];
      series?: TableSeries;
      chaos?: PublicChaosView | null;
    }
  | { t: 'social'; me: PublicPlayer; friends: PublicPlayer[]; requests: Friendship[]; inbox: PlatformNotice[]; games: GameSummary[] }
  | {
      t: 'intent';
      seat: SeatId;
      id?: string;
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
        | 'liesClear';
      cards?: string[];
      cardId?: string;
      intoCardId?: string;
      abilityId?: ChaosAbilityId;
      targetSeat?: SeatId;
      rank?: StandardRank;
    }
  | { t: 'chat'; id: string; seat: SeatId; name: string; text: string; at: number }
  | { t: 'chatHistory'; messages: ChatMessage[] }
  | {
      t: 'reaction';
      eventId: string;
      roomId: string;
      senderPlayerId: string;
      senderSeat?: number;
      targetPlayerId: string;
      targetSeat?: number;
      reactionId: ReactionId;
      requestId: string;
      serverTimestamp: number;
    }
  | { t: 'reactionDenied'; requestId: string; reason: string; retryAfterMs?: number }
  | { t: 'ended'; gameId: string; reason?: 'admin' | 'empty'; code?: string }
  | { t: 'error'; message: string };

export function toGameRoom(snapshot: RelayRoom, myId: string | null): GameRoom {
  const mapped: RoomSeat[] = snapshot.seats.map((seat) => {
    if (!seat) {
      return emptyRoomSeat();
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
      playerId: seat.playerId ?? null,
    };
  });
  const mode = snapshot.mode ?? '2v2';
  return {
    id: snapshot.id ?? snapshot.code,
    code: snapshot.code,
    host: snapshot.hostId === myId,
    started: snapshot.started,
    mode,
    liesDeckCount: snapshot.liesDeckCount === 2 ? 2 : 1,
    seats: seatsForMode(mode, mapped, mapped.length),
    pendingJoins: snapshot.pendingJoins ?? [],
  };
}
