import { Card, StandardRank } from '../cards/types';
import { SeatId } from '../game/types';

export type LiesPhase = 'claiming' | 'responding' | 'lastConfirm' | 'handComplete';

export type LiesClaim = {
  seat: SeatId;
  rank: StandardRank;
  count: number;
  cards: Card[];
};

export type LiesPile = {
  cards: Card[];
  claims: LiesClaim[];
};

export type LiesEvent =
  | { kind: 'claim'; seat: SeatId; rank: StandardRank; count: number; cardIds: string[] }
  | { kind: 'believe'; seat: SeatId }
  | { kind: 'challenge'; seat: SeatId; truthful: boolean; revealedIds: string[] }
  | { kind: 'clear'; seat: SeatId; removedCount: number }
  | { kind: 'finished'; seat: SeatId; place: number }
  | { kind: 'pileTaken'; seat: SeatId; count: number };

export type LiesState = {
  schemaVersion: 1;
  mode: 'lies';
  deckCount: 1 | 2;
  playerCount: number;
  hands: Card[][];
  undealt: Card[];
  currentSeat: SeatId;
  phase: LiesPhase;
  pile: LiesPile | null;
  claimedRank: StandardRank | null;
  lastClaim: LiesClaim | null;
  /** Unfinished seats still to respond, in clockwise order after the last claimant. */
  respondersLeft: SeatId[];
  finishOrder: SeatId[];
  removedCount: number;
  /** Face-down claim flight: who just put cards on the pile. */
  lastPlay: { seat: SeatId; count: number; at: number } | null;
  /** Challenge outcome + full pile the taker received. */
  lastReveal: LiesPileReveal | null;
  history: LiesEvent[];
};

export type LiesPileReveal = {
  at: number;
  truthful: boolean;
  challengerSeat: SeatId;
  claimSeat: SeatId;
  claimedRank: StandardRank;
  claimedCount: number;
  /** Cards from the challenged claim — public to everyone. */
  lastBatch: Card[];
  /** Full pile taken. Only filled for the taker in public views. */
  pileCards: Card[];
  /** How many cards moved to the taker (always public). */
  takenCount: number;
  takenBy: SeatId;
};

/** Latest visible action under a seat name. */
export type LiesSeatAct = 'added' | 'believed' | 'calledLie' | 'cleared' | 'tookPile';

export type PublicLiesView = {
  mode: 'lies';
  deckCount: 1 | 2;
  playerCount: number;
  phase: LiesPhase;
  currentSeat: SeatId;
  ownHand: Card[];
  cardCounts: number[];
  pileCount: number;
  claimedRank: StandardRank | null;
  lastClaim: { seat: SeatId; rank: StandardRank; count: number } | null;
  /** Most recent action per seat (null if none yet). */
  lastActs: (LiesSeatAct | null)[];
  respondersLeft: SeatId[];
  finishOrder: SeatId[];
  removedCount: number;
  lastPlay: { seat: SeatId; count: number; at: number } | null;
  lastReveal: LiesPileReveal | null;
  maxPlay: number;
  canClaim: boolean;
  canBelieve: boolean;
  canChallenge: boolean;
  canClear: boolean;
  handComplete: boolean;
};

export type LiesAction =
  | { type: 'claim'; cards: Card[]; rank: StandardRank }
  | { type: 'believe' }
  | { type: 'challenge' }
  | { type: 'clear' };

export type LiesError = {
  ok: false;
  code: string;
  message: string;
};
