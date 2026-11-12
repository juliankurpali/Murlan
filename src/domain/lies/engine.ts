import { createSeededRandom, mathRandomSource, RandomSource } from '../cards/random';
import { sortHand } from '../cards/strength';
import { Card, StandardRank } from '../cards/types';
import { SeatId } from '../game/types';
import { activeSeats, dealLies, maxPlayFor, nextClockwise } from './deck';
import { LiesClaim, LiesError, LiesState } from './types';

export type CreateLiesInput = {
  playerCount: number;
  deckCount: 1 | 2;
  random?: RandomSource;
  openingSeat?: SeatId;
};

function fail(code: string, message: string): LiesError {
  return { ok: false, code, message };
}

function unfinished(state: LiesState): SeatId[] {
  const done = new Set(state.finishOrder);
  return activeSeats(state.playerCount).filter((seat) => !done.has(seat));
}

function isFinished(state: LiesState, seat: SeatId): boolean {
  return state.finishOrder.includes(seat);
}

function takeCardsFromHand(hand: Card[], cardIds: string[]): { ok: true; cards: Card[]; rest: Card[] } | LiesError {
  const remaining = [...hand];
  const cards: Card[] = [];
  for (const id of cardIds) {
    const index = remaining.findIndex((card) => card.id === id);
    if (index < 0) {
      return fail('cardNotInHand', `Card ${id} is not in hand`);
    }
    cards.push(remaining[index]!);
    remaining.splice(index, 1);
  }
  return { ok: true, cards, rest: remaining };
}

function cardsMatchRank(cards: Card[], rank: StandardRank): boolean {
  return cards.every((card) => card.kind === 'standard' && card.rank === rank);
}

function respondersAfter(state: LiesState, claimant: SeatId): SeatId[] {
  const result: SeatId[] = [];
  let seat = nextClockwise(claimant, state.playerCount);
  for (let i = 0; i < state.playerCount - 1; i += 1) {
    if (!isFinished(state, seat) && seat !== claimant) {
      result.push(seat);
    }
    seat = nextClockwise(seat, state.playerCount);
  }
  return result;
}

/**
 * Record a player who just emptied their hand.
 * Ranking is chronological (first empty = better place). The hand does not
 * end here — believe / lie must resolve first; a lost challenge can revive them.
 */
function markFinishedIfEmpty(state: LiesState, seat: SeatId): LiesState {
  if (isFinished(state, seat)) {
    return state;
  }
  if ((state.hands[seat] ?? []).length > 0) {
    return state;
  }
  const finishOrder = [...state.finishOrder, seat];
  const place = finishOrder.length;
  const history = [...state.history, { kind: 'finished' as const, seat, place }];
  return { ...state, finishOrder, history };
}

function reviveIfNeeded(state: LiesState, seat: SeatId): LiesState {
  if (!isFinished(state, seat)) {
    return state;
  }
  if ((state.hands[seat] ?? []).length === 0) {
    return state;
  }
  return {
    ...state,
    finishOrder: state.finishOrder.filter((item) => item !== seat),
    history: state.history.filter((event) => !(event.kind === 'finished' && event.seat === seat)),
  };
}

function maybeComplete(state: LiesState): LiesState {
  const left = unfinished(state);
  if (left.length > 1) {
    return state;
  }
  if (left.length === 1) {
    const last = left[0]!;
    const finishOrder = [...state.finishOrder, last];
    return {
      ...state,
      finishOrder,
      phase: 'handComplete',
      currentSeat: last,
      respondersLeft: [],
      history: [...state.history, { kind: 'finished', seat: last, place: finishOrder.length }],
    };
  }
  return { ...state, phase: 'handComplete', respondersLeft: [] };
}

function givePileTo(state: LiesState, seat: SeatId): LiesState {
  const pile = state.pile;
  if (!pile) {
    return state;
  }
  const hands = state.hands.map((hand, index) =>
    index === seat ? sortHand([...hand, ...pile.cards]) : [...hand],
  );
  let next: LiesState = {
    ...state,
    hands,
    pile: null,
    claimedRank: null,
    lastClaim: null,
    respondersLeft: [],
    phase: 'claiming',
    currentSeat: seat,
    history: [...state.history, { kind: 'pileTaken', seat, count: pile.cards.length }],
  };
  next = reviveIfNeeded(next, seat);
  return maybeComplete(next);
}

export function createLiesGame(input: CreateLiesInput): LiesState {
  const random = input.random ?? mathRandomSource();
  const dealt = dealLies(input.playerCount, input.deckCount, random);
  const hands = dealt.hands.map((hand) => sortHand(hand));
  const undealt = dealt.undealt;
  const opening =
    input.openingSeat ??
    (Math.floor(random.next() * input.playerCount) as SeatId);
  return {
    schemaVersion: 1,
    mode: 'lies',
    deckCount: input.deckCount,
    playerCount: input.playerCount,
    hands,
    undealt,
    currentSeat: opening,
    phase: 'claiming',
    pile: null,
    claimedRank: null,
    lastClaim: null,
    respondersLeft: [],
    finishOrder: [],
    removedCount: 0,
    lastPlay: null,
    lastReveal: null,
    history: [],
  };
}

export function isLiesError(value: unknown): value is LiesError {
  return Boolean(value && typeof value === 'object' && (value as LiesError).ok === false);
}

export function applyLiesClaim(
  state: LiesState,
  seat: SeatId,
  cardIds: string[],
  rank: StandardRank,
): LiesState | LiesError {
  if (state.phase === 'handComplete') {
    return fail('handComplete', 'Hand is over');
  }
  if (isFinished(state, seat)) {
    return fail('alreadyFinished', 'Player already finished');
  }
  const adding =
    (state.phase === 'responding' || state.phase === 'lastConfirm' || state.phase === 'claiming') &&
    state.pile !== null &&
    state.claimedRank !== null;
  const leading = state.phase === 'claiming' && state.pile === null;

  if (!leading && !adding) {
    return fail('wrongPhase', 'Cannot claim now');
  }
  if (state.currentSeat !== seat) {
    return fail('notYourTurn', 'Not your turn');
  }
  if (adding && state.claimedRank !== rank) {
    return fail('wrongRank', 'Must claim the same rank as the pile');
  }
  if (cardIds.length < 1) {
    return fail('emptyClaim', 'Select at least one card');
  }
  const max = Math.min((state.hands[seat] ?? []).length, maxPlayFor(state.deckCount));
  if (cardIds.length > max) {
    return fail('tooManyCards', `At most ${max} cards`);
  }

  const taken = takeCardsFromHand(state.hands[seat] ?? [], cardIds);
  if (!taken.ok) {
    return taken;
  }

  const claim: LiesClaim = {
    seat,
    rank,
    count: taken.cards.length,
    cards: taken.cards,
  };
  const prior = state.pile?.cards ?? [];
  const priorClaims = state.pile?.claims ?? [];
  const hands = state.hands.map((hand, index) => (index === seat ? sortHand(taken.rest) : [...hand]));

  let next: LiesState = {
    ...state,
    hands,
    pile: { cards: [...prior, ...taken.cards], claims: [...priorClaims, claim] },
    claimedRank: leading ? rank : state.claimedRank,
    lastClaim: claim,
    lastPlay: { seat, count: claim.count, at: Date.now() },
    lastReveal: null,
    history: [
      ...state.history,
      { kind: 'claim', seat, rank, count: claim.count, cardIds: taken.cards.map((card) => card.id) },
    ],
  };
  // Rank empties immediately (first empty wins ties), but wait for believe/lie
  // before ending the hand — a challenge may give the pile back.
  next = markFinishedIfEmpty(next, seat);

  const responders = respondersAfter(next, seat);
  if (responders.length === 0) {
    // Nobody left to believe/lie — settle places now.
    return maybeComplete({
      ...next,
      phase: 'claiming',
      respondersLeft: [],
      currentSeat: isFinished(next, seat) ? unfinished(next)[0] ?? seat : seat,
    });
  }
  return {
    ...next,
    phase: 'responding',
    respondersLeft: responders,
    currentSeat: responders[0]!,
  };
}

export function applyLiesBelieve(state: LiesState, seat: SeatId): LiesState | LiesError {
  if (state.phase !== 'responding') {
    return fail('wrongPhase', 'Cannot believe now');
  }
  if (state.currentSeat !== seat) {
    return fail('notYourTurn', 'Not your turn');
  }
  if (state.respondersLeft[0] !== seat) {
    return fail('notYourTurn', 'Not your turn to respond');
  }
  const respondersLeft = state.respondersLeft.slice(1);
  const history = [...state.history, { kind: 'believe' as const, seat }];
  if (respondersLeft.length > 0) {
    return {
      ...state,
      respondersLeft,
      currentSeat: respondersLeft[0]!,
      history,
    };
  }
  if (!state.lastClaim) {
    return fail('noClaim', 'Nothing to confirm');
  }
  // Everyone believed — empty-hand finishes stand. Claimant clears (or adds if able).
  return {
    ...state,
    respondersLeft: [],
    phase: 'lastConfirm',
    currentSeat: state.lastClaim.seat,
    history,
  };
}

export function applyLiesChallenge(state: LiesState, seat: SeatId): LiesState | LiesError {
  if (state.phase !== 'responding') {
    return fail('wrongPhase', 'Cannot challenge now');
  }
  if (state.currentSeat !== seat) {
    return fail('notYourTurn', 'Not your turn');
  }
  const last = state.lastClaim;
  if (!last) {
    return fail('noClaim', 'Nothing to challenge');
  }
  const truthful = cardsMatchRank(last.cards, last.rank);
  const takenBy = truthful ? seat : last.seat;
  const pileCards = [...(state.pile?.cards ?? [])];
  const revealed = {
    at: Date.now(),
    truthful,
    challengerSeat: seat,
    claimSeat: last.seat,
    claimedRank: last.rank,
    claimedCount: last.count,
    lastBatch: [...last.cards],
    pileCards,
    takenCount: pileCards.length,
    takenBy,
  };
  const history = [
    ...state.history,
    {
      kind: 'challenge' as const,
      seat,
      truthful,
      revealedIds: last.cards.map((card) => card.id),
    },
  ];
  let next: LiesState = {
    ...state,
    lastReveal: revealed,
    lastPlay: null,
    history,
    respondersLeft: [],
  };
  next = givePileTo(next, takenBy);
  // Keep the reveal after givePileTo (it spreads state but we re-set for safety).
  next = { ...next, lastReveal: revealed };
  if (next.phase === 'handComplete') {
    return next;
  }
  const leader = truthful
    ? isFinished(next, last.seat)
      ? unfinished(next)[0] ?? seat
      : last.seat
    : isFinished(next, seat)
      ? unfinished(next)[0] ?? last.seat
      : seat;
  return { ...next, phase: 'claiming', currentSeat: leader };
}

export function applyLiesClear(state: LiesState, seat: SeatId): LiesState | LiesError {
  if (state.phase !== 'lastConfirm') {
    return fail('wrongPhase', 'Cannot clear now');
  }
  if (state.currentSeat !== seat) {
    return fail('notYourTurn', 'Not your turn');
  }
  if (!state.lastClaim || state.lastClaim.seat !== seat) {
    return fail('notClaimant', 'Only the last claimant can clear');
  }
  const removed = state.pile?.cards.length ?? 0;
  let next: LiesState = {
    ...state,
    pile: null,
    claimedRank: null,
    lastClaim: null,
    respondersLeft: [],
    removedCount: state.removedCount + removed,
    phase: 'claiming',
    lastPlay: null,
    lastReveal: null,
    history: [...state.history, { kind: 'clear', seat, removedCount: removed }],
  };
  next = markFinishedIfEmpty(next, seat);
  next = maybeComplete(next);
  if (next.phase === 'handComplete') {
    return next;
  }
  const leader = isFinished(next, seat) ? unfinished(next)[0] ?? seat : seat;
  return { ...next, currentSeat: leader };
}

/** Convenience for tests — seedable create. */
export function createLiesGameSeeded(
  playerCount: number,
  deckCount: 1 | 2,
  seed: number,
  openingSeat?: SeatId,
): LiesState {
  return createLiesGame({
    playerCount,
    deckCount,
    random: createSeededRandom(seed),
    openingSeat,
  });
}
