import { sortHand } from '../cards/strength';
import { SeatId } from '../game/types';
import { maxPlayFor } from './deck';
import { LiesSeatAct, LiesState, PublicLiesView } from './types';

function lastActsFromHistory(state: LiesState): (LiesSeatAct | null)[] {
  const acts: (LiesSeatAct | null)[] = Array.from({ length: state.playerCount }, () => null);
  // Only show actions for the current pile — wipe when the previous pile was
  // cleared or taken after a challenge.
  let start = 0;
  for (let i = 0; i < state.history.length; i += 1) {
    const event = state.history[i];
    if (event?.kind === 'clear' || event?.kind === 'pileTaken') {
      start = i + 1;
    }
  }
  for (let i = start; i < state.history.length; i += 1) {
    const event = state.history[i];
    if (!event) continue;
    if (event.kind === 'claim') {
      acts[event.seat] = 'added';
    } else if (event.kind === 'believe') {
      acts[event.seat] = 'believed';
    } else if (event.kind === 'challenge') {
      acts[event.seat] = 'calledLie';
    }
  }
  return acts;
}

export function toPublicLiesView(state: LiesState, seat: SeatId): PublicLiesView {
  const myTurn = state.currentSeat === seat && state.phase !== 'handComplete';
  const finished = state.finishOrder.includes(seat);
  return {
    mode: 'lies',
    deckCount: state.deckCount,
    playerCount: state.playerCount,
    phase: state.phase,
    currentSeat: state.currentSeat,
    ownHand: sortHand(state.hands[seat] ?? []),
    cardCounts: state.hands.map((hand) => hand.length),
    pileCount: state.pile?.cards.length ?? 0,
    claimedRank: state.claimedRank,
    lastClaim: state.lastClaim
      ? { seat: state.lastClaim.seat, rank: state.lastClaim.rank, count: state.lastClaim.count }
      : null,
    lastActs: lastActsFromHistory(state),
    respondersLeft: [...state.respondersLeft],
    finishOrder: [...state.finishOrder],
    removedCount: state.removedCount,
    lastPlay: state.lastPlay ? { ...state.lastPlay } : null,
    lastReveal: state.lastReveal
      ? {
          ...state.lastReveal,
          lastBatch: [...state.lastReveal.lastBatch],
          // Only the taker sees every card they scooped; everyone else sees the challenged batch.
          pileCards:
            state.lastReveal.takenBy === seat ? [...state.lastReveal.pileCards] : [],
          takenCount: state.lastReveal.takenCount ?? state.lastReveal.pileCards.length,
        }
      : null,
    maxPlay: Math.min((state.hands[seat] ?? []).length, maxPlayFor(state.deckCount)),
    canClaim:
      myTurn &&
      !finished &&
      (state.phase === 'claiming' ||
        (state.phase === 'responding' && state.pile !== null) ||
        (state.phase === 'lastConfirm' && state.pile !== null && (state.hands[seat] ?? []).length > 0)),
    canBelieve: myTurn && !finished && state.phase === 'responding',
    canChallenge: myTurn && !finished && state.phase === 'responding' && state.lastClaim !== null,
    // Finished emptiers still clear the pile after everyone believes.
    canClear: myTurn && state.phase === 'lastConfirm' && state.lastClaim?.seat === seat,
    handComplete: state.phase === 'handComplete',
  };
}
