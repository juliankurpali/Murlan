import { compareCards, sortHand } from '../cards/strength';
import { BLACK_JOKER_ID, RED_JOKER_ID } from '../cards/types';
import { Card } from '../cards/types';
import { CardExchangeResult, PendingExchange, SeatId } from './types';

function cloneHands(hands: [Card[], Card[], Card[], Card[]]): [Card[], Card[], Card[], Card[]] {
  return [hands[0].slice(), hands[1].slice(), hands[2].slice(), hands[3].slice()];
}

function takeHighest(hand: Card[]): Card {
  return [...hand].sort(compareCards)[hand.length - 1]!;
}

export function hasBothJokers(hand: Card[]): boolean {
  const ids = new Set(hand.map((card) => card.id));
  return ids.has(BLACK_JOKER_ID) && ids.has(RED_JOKER_ID);
}

/**
 * First place’s automatic return: lowest rank 3–10 they hold (not the card just received).
 * If they have no 3–10, they return their lowest remaining card.
 */
export function defaultReturnCard(hand: Card[], receivedId: string): Card {
  const candidates = hand.filter((card) => card.id !== receivedId);
  const pool = candidates.length > 0 ? candidates : hand;
  const low = pool.filter((card) => card.kind === 'standard' && card.rank >= 3 && card.rank <= 10);
  const source = low.length > 0 ? low : pool;
  return sortHand(source)[0]!;
}

export function lastPlaceSeat(finishOrder: SeatId[]): SeatId | null {
  const leftover = ([0, 1, 2, 3] as SeatId[]).filter((seat) => !finishOrder.includes(seat));
  if (leftover.length === 1) {
    return leftover[0]!;
  }
  if (finishOrder.length >= 4) {
    return finishOrder[3] ?? null;
  }
  return leftover[leftover.length - 1] ?? null;
}

export function beginCardExchange(
  hands: [Card[], Card[], Card[], Card[]],
  firstSeat: SeatId,
  lastSeat: SeatId,
): { hands: [Card[], Card[], Card[], Card[]]; givenToFirst: Card; pending: PendingExchange } | null {
  if (hands[lastSeat].length === 0 || hands[firstSeat].length === 0) {
    return null;
  }
  const next = cloneHands(hands);
  const givenToFirst = takeHighest(next[lastSeat]);
  next[lastSeat] = next[lastSeat].filter((card) => card.id !== givenToFirst.id);
  next[firstSeat] = [...next[firstSeat], givenToFirst];
  return {
    hands: next,
    givenToFirst,
    pending: { firstSeat, lastSeat, givenToFirst },
  };
}

export function finishCardExchange(
  hands: [Card[], Card[], Card[], Card[]],
  pending: PendingExchange,
  returnedToLast: Card,
): { hands: [Card[], Card[], Card[], Card[]]; exchange: CardExchangeResult } {
  const next = cloneHands(hands);
  next[pending.firstSeat] = next[pending.firstSeat].filter((card) => card.id !== returnedToLast.id);
  next[pending.lastSeat] = [...next[pending.lastSeat], returnedToLast];
  return {
    hands: next,
    exchange: {
      kind: 'swap',
      firstSeat: pending.firstSeat,
      lastSeat: pending.lastSeat,
      givenToFirst: pending.givenToFirst,
      returnedToLast,
    },
  };
}

export function applyCardExchange(
  hands: [Card[], Card[], Card[], Card[]],
  options: {
    enabled: boolean;
    firstSeat: SeatId | null;
    lastSeat: SeatId | null;
    awaitReturnChoice?: boolean;
    returnedCard?: Card;
  },
): {
  hands: [Card[], Card[], Card[], Card[]];
  exchange: CardExchangeResult | null;
  pending: PendingExchange | null;
} {
  const { enabled, firstSeat, lastSeat, awaitReturnChoice = false, returnedCard } = options;
  if (!enabled || firstSeat === null || lastSeat === null || firstSeat === lastSeat) {
    return { hands, exchange: null, pending: null };
  }
  if (hands[lastSeat].length === 0 || hands[firstSeat].length === 0) {
    return { hands, exchange: null, pending: null };
  }
  if (hasBothJokers(hands[lastSeat])) {
    return {
      hands,
      exchange: { kind: 'skipped', firstSeat, lastSeat, reason: 'bothJokers' },
      pending: null,
    };
  }

  const begun = beginCardExchange(hands, firstSeat, lastSeat);
  if (!begun) {
    return { hands, exchange: null, pending: null };
  }
  if (awaitReturnChoice && !returnedCard) {
    return { hands: begun.hands, exchange: null, pending: begun.pending };
  }

  const returned = returnedCard ?? defaultReturnCard(begun.hands[firstSeat], begun.givenToFirst.id);
  const finished = finishCardExchange(begun.hands, begun.pending, returned);
  return { hands: finished.hands, exchange: finished.exchange, pending: null };
}
