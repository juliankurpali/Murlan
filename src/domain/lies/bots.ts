import { Card, StandardRank, STANDARD_RANKS } from '../cards/types';
import { SeatId } from '../game/types';
import { maxPlayFor } from './deck';
import {
  applyLiesBelieve,
  applyLiesChallenge,
  applyLiesClaim,
  applyLiesClear,
  isLiesError,
} from './engine';
import { LiesState } from './types';

function countRank(hand: Card[], rank: StandardRank): Card[] {
  return hand.filter((card) => card.kind === 'standard' && card.rank === rank);
}

function pickBluffCards(hand: Card[], count: number): Card[] {
  const sorted = [...hand].sort((a, b) => {
    const ra = a.kind === 'standard' ? a.rank : 99;
    const rb = b.kind === 'standard' ? b.rank : 99;
    return ra - rb;
  });
  return sorted.slice(0, count);
}

function chooseClaim(
  state: LiesState,
  seat: SeatId,
): { cards: Card[]; rank: StandardRank } | null {
  const hand = state.hands[seat] ?? [];
  if (hand.length === 0) {
    return null;
  }
  const max = Math.min(hand.length, maxPlayFor(state.deckCount));
  const fixed = state.claimedRank;

  if (fixed !== null) {
    const truth = countRank(hand, fixed);
    if (truth.length > 0 && Math.random() < 0.7) {
      const n = Math.min(truth.length, Math.max(1, Math.min(2, max)));
      return { cards: truth.slice(0, n), rank: fixed };
    }
    const n = Math.min(max, Math.random() < 0.5 ? 1 : 2);
    return { cards: pickBluffCards(hand, n), rank: fixed };
  }

  // Lead: prefer a rank we hold, small truthful dump.
  let best: { cards: Card[]; rank: StandardRank } | null = null;
  for (const rank of STANDARD_RANKS) {
    const held = countRank(hand, rank);
    if (held.length === 0) continue;
    const n = Math.min(held.length, Math.max(1, Math.min(2, max)));
    const pick = { cards: held.slice(0, n), rank };
    if (!best || pick.cards.length > best.cards.length) {
      best = pick;
    }
  }
  if (best && Math.random() < 0.75) {
    return best;
  }
  const rank = STANDARD_RANKS[Math.floor(Math.random() * STANDARD_RANKS.length)] ?? 3;
  const n = Math.min(max, 1);
  return { cards: pickBluffCards(hand, n), rank };
}

function shouldChallenge(state: LiesState): boolean {
  const last = state.lastClaim;
  if (!last) return false;
  if (last.count >= 3) return Math.random() < 0.55;
  if (last.count >= 2) return Math.random() < 0.28;
  return Math.random() < 0.12;
}

/** Apply one bot action for the current seat. Returns null if nothing to do. */
export function applyLiesBotTurn(state: LiesState): LiesState | null {
  if (state.phase === 'handComplete') {
    return null;
  }
  const seat = state.currentSeat;
  if (state.finishOrder.includes(seat)) {
    return null;
  }

  if (state.phase === 'lastConfirm') {
    const hand = state.hands[seat] ?? [];
    if (hand.length === 0 || Math.random() < 0.65) {
      const cleared = applyLiesClear(state, seat);
      return isLiesError(cleared) ? null : cleared;
    }
    const claim = chooseClaim(state, seat);
    if (!claim) {
      const cleared = applyLiesClear(state, seat);
      return isLiesError(cleared) ? null : cleared;
    }
    const added = applyLiesClaim(
      state,
      seat,
      claim.cards.map((c) => c.id),
      claim.rank,
    );
    return isLiesError(added) ? null : added;
  }

  if (state.phase === 'responding') {
    if (shouldChallenge(state)) {
      const challenged = applyLiesChallenge(state, seat);
      if (!isLiesError(challenged)) {
        return challenged;
      }
    }
    if (Math.random() < 0.35) {
      const claim = chooseClaim(state, seat);
      if (claim) {
        const added = applyLiesClaim(
          state,
          seat,
          claim.cards.map((c) => c.id),
          claim.rank,
        );
        if (!isLiesError(added)) {
          return added;
        }
      }
    }
    const believed = applyLiesBelieve(state, seat);
    return isLiesError(believed) ? null : believed;
  }

  if (state.phase === 'claiming') {
    const claim = chooseClaim(state, seat);
    if (!claim) {
      return null;
    }
    const played = applyLiesClaim(
      state,
      seat,
      claim.cards.map((c) => c.id),
      claim.rank,
    );
    return isLiesError(played) ? null : played;
  }

  return null;
}
