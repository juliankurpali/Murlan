import { CombinationType, GameState, MatchMode, PublicMatchView, SeatId } from '../domain';
import { ChatMessage } from '../online/chat';
import { ConnectionState } from '../online/lifecycle';

export const AVATARS = ['gold', 'crimson', 'sage', 'night', 'ivory', 'copper'] as const;
export type AvatarId = (typeof AVATARS)[number];

export type PlatformPlayer = {
  id: string;
  username: string;
  displayName: string;
  avatar: AvatarId;
  identityHash: string;
  createdAt: number;
  lastSeen: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  teamWins: number;
  individualWins: number;
  blocked: string[];
};

export type PublicPlayer = {
  id: string;
  username: string;
  displayName: string;
  avatar: AvatarId;
  online: boolean;
  playing: boolean;
  playingGameId: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  teamWins: number;
  individualWins: number;
};

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: number;
  fromUsername?: string;
};

export type GameInvite = {
  id: string;
  gameId: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  preferredTeam: 0 | 1 | null;
};

export type JoinRequest = {
  id: string;
  gameId: string;
  fromId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  preferredTeam: 0 | 1 | null;
};

export type SeatSwitchRequest = {
  id: string;
  gameId: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
};

export type GameSeat = {
  userId: string | null;
  isBot: boolean;
  botName: string | null;
  connection: ConnectionState;
  muted: boolean;
  speaking: boolean;
  voiceAvailable: boolean;
  lobbyReady: boolean;
};

export type PlatformGame = {
  id: string;
  code: string;
  mode: MatchMode;
  status: 'lobby' | 'playing' | 'complete';
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  seats: [GameSeat, GameSeat, GameSeat, GameSeat];
  match: GameState | null;
  chat: ChatMessage[];
  seenIntents: Record<string, string[]>;
  nextHandReady: SeatId[];
};

export type MatchHistoryRow = {
  id: string;
  gameId: string;
  mode: MatchMode;
  at: number;
  userId: string;
  won: boolean;
  score: number;
};

export type NotifyKind =
  | 'friend-request'
  | 'friend-accept'
  | 'invite'
  | 'friend-online'
  | 'friend-playing'
  | 'join-request'
  | 'join-accepted'
  | 'join-denied'
  | 'seat-switch'
  | 'seat-switch-denied';

export type PlatformNotice = {
  id: string;
  userId: string;
  kind: NotifyKind;
  title: string;
  body: string;
  fromId: string | null;
  gameId: string | null;
  at: number;
  read: boolean;
};

export type PlatformSnapshot = {
  players: PlatformPlayer[];
  sessions: { token: string; userId: string; expiresAt: number }[];
  friends: Friendship[];
  games: PlatformGame[];
  invites: GameInvite[];
  joinRequests: JoinRequest[];
  seatSwitches: SeatSwitchRequest[];
  history: MatchHistoryRow[];
  notices: PlatformNotice[];
};

export type AuthResult = {
  token: string;
  player: PublicPlayer;
};

export type GameSummary = {
  id: string;
  code: string;
  mode: MatchMode;
  status: PlatformGame['status'];
  createdBy: string;
  updatedAt: number;
  seats: {
    name: string;
    userId: string | null;
    isBot: boolean;
    connection: ConnectionState;
    isYou: boolean;
    muted: boolean;
    speaking: boolean;
    voiceAvailable: boolean;
    ready: boolean;
  }[];
  invited: boolean;
  joinPending: boolean;
  pendingJoins: { fromId: string; username: string }[];
};

export type JoinOutcome = {
  game: GameSummary;
  pending: boolean;
};

export type AdminSeatView = {
  name: string;
  isBot: boolean;
  empty: boolean;
  isHost: boolean;
  connection: ConnectionState;
  muted: boolean;
  speaking: boolean;
  voiceAvailable: boolean;
  lobbyReady: boolean;
  cards: number | null;
  score: number | null;
};

export type AdminGameView = {
  id: string;
  code: string;
  mode: MatchMode;
  status: 'lobby' | 'playing';
  createdAt: number;
  updatedAt: number;
  hostName: string;
  seats: AdminSeatView[];
  pendingJoins: string[];
  phase: GameState['phase'] | null;
  handIndex: number | null;
  currentName: string | null;
  targetScore: number | null;
  teamScores: { team0: number; team1: number } | null;
  trick: CombinationType | null;
  chatLines: number;
  humans: number;
  bots: number;
  connectedHumans: number;
};

export type AdminPlayerView = {
  username: string;
  online: boolean;
  lastSeen: number;
  gamesPlayed: number;
  wins: number;
  tableCode: string | null;
  tableStatus: PlatformGame['status'] | null;
};

export type AdminSnapshot = {
  at: number;
  accounts: number;
  online: number;
  lobbies: number;
  playing: number;
  waitingJoins: number;
  games: AdminGameView[];
  players: AdminPlayerView[];
};

export type TablePayload = {
  gameId: string;
  code: string;
  seat: SeatId;
  view: PublicMatchView;
  legalCardIds: string[];
  humanTurn: boolean;
  nextHandReady: SeatId[];
};

export type InboxItem = PlatformNotice;
