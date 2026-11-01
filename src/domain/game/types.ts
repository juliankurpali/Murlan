import { Card } from '../cards/types';
import { RulesConfig } from '../rules/types';

export type SeatId = 0 | 1 | 2 | 3 | 4 | 5;

export type MatchMode = '2v2' | 'chaos' | 'super';

export type GamePhase = 'playing' | 'exchanging' | 'handComplete' | 'matchComplete';

export type CombinationType = 'single' | 'pair' | 'triple' | 'straight' | 'bomb' | 'flush';

export type SequenceKind = 'high' | 'aceLow';

export type Combination = {
  type: CombinationType;
  cards: Card[];
  strength: number;
  length: number;
  sequence?: SequenceKind;
};

export type InvalidCombination = {
  type: 'invalid';
  reason: string;
};

export type DetectedCombination = Combination | InvalidCombination;

export type RuleErrorCode =
  | 'notYourTurn'
  | 'wrongPhase'
  | 'cardNotInHand'
  | 'duplicateCards'
  | 'invalidCombination'
  | 'cannotBeat'
  | 'cannotPassOnLead'
  | 'mustIncludeThreeOfSpades'
  | 'emptyPlay'
  | 'matchComplete'
  | 'invalidExchangeCard';

export type RuleError = {
  type: 'RuleError';
  code: RuleErrorCode;
  message: string;
};

export type TrickState = {
  leaderSeat: SeatId;
  combination: Combination | null;
  lastSuccessfulSeat: SeatId | null;
  passedSinceLastPlay: SeatId[];
};

export type PublicPlayEvent =
  | { kind: 'play'; seat: SeatId; cards: Card[]; combination: Combination }
  | { kind: 'pass'; seat: SeatId }
  | { kind: 'trickWon'; seat: SeatId }
  | { kind: 'finished'; seat: SeatId; place: number };

export type MatchWinner = SeatId | 'team0' | 'team1' | 'team2';

export type PendingExchange = {
  firstSeat: SeatId;
  lastSeat: SeatId;
  givenToFirst: Card;
};

export type CardExchangeResult =
  | {
      kind: 'swap';
      firstSeat: SeatId;
      lastSeat: SeatId;
      givenToFirst: Card;
      returnedToLast: Card;
    }
  | {
      kind: 'skipped';
      firstSeat: SeatId;
      lastSeat: SeatId;
      reason: 'bothJokers';
    };

export type GameState = {
  schemaVersion: 1;
  mode: MatchMode;
  rules: RulesConfig;
  handIndex: number;
  dealerSeat: SeatId;
  hands: Card[][];
  teamOf: number[];
  undealt: Card[];
  currentSeat: SeatId;
  trick: TrickState;
  finishOrder: SeatId[];
  scores: number[];
  targetScore: number;
  phase: GamePhase;
  history: PublicPlayEvent[];
  winner: MatchWinner | null;
  lastHandPoints: number[] | null;
  lastExchange: CardExchangeResult | null;
  pendingExchange: PendingExchange | null;
  extraTurnSeat?: SeatId | null;
  extraTurnUsed?: boolean;
};

export type TeamScores = {
  team0: number;
  team1: number;
  team2?: number;
};

export type PublicMatchView = {
  mode: MatchMode;
  viewerSeat: SeatId;
  ownHand: Card[];
  cardCounts: number[];
  currentSeat: SeatId;
  trick: TrickState;
  scores: number[];
  teamScores: TeamScores;
  teamOf: number[];
  finishOrder: SeatId[];
  phase: GamePhase;
  targetScore: number;
  handIndex: number;
  winner: MatchWinner | null;
  lastHandPoints: number[] | null;
  lastExchange: CardExchangeResult | null;
  pendingExchange: PendingExchange | null;
  cardExchangeEnabled: boolean;
  undealtCount: number;
  history: PublicPlayEvent[];
};

export type BotView = {
  seat: SeatId;
  hand: Card[];
  cardCounts: number[];
  currentSeat: SeatId;
  trick: TrickState;
  finishOrder: SeatId[];
  scores: number[];
  history: PublicPlayEvent[];
  mode: MatchMode;
  rules: RulesConfig;
  phase: GamePhase;
  handIndex: number;
};

export function isRuleError(value: GameState | RuleError): value is RuleError {
  return (value as RuleError).type === 'RuleError';
}

export function isCombination(value: DetectedCombination): value is Combination {
  return value.type !== 'invalid';
}

export const SEATS: SeatId[] = [0, 1, 2, 3];

export function teamId(seat: SeatId, teamOf?: number[]): number {
  const mapped = teamOf?.[seat];
  if (mapped === 0 || mapped === 1 || mapped === 2) {
    return mapped;
  }
  return seat % 2;
}
