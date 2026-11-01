import { createDeck, createSuperDeck, validateSuperDeck } from '../cards/deck';
import { RandomSource } from '../cards/random';
import { shuffleDeck } from '../cards/shuffle';
import { Card, isThreeOfSpades } from '../cards/types';
import { mergeRules, SUPER_RULES } from '../rules/defaults';
import { RulesConfig } from '../rules/types';
import { canBeat, describeCannotBeat } from './beating';
import { combinationLabel, detectCombination } from './combinations';
import { cloneHands, dealCards, dealLimited, dealerForHand } from './deal';
import { limitStraightLength, spiceDeck } from './spiceDeal';
import { applyCardExchange, defaultReturnCard, finishCardExchange, lastPlaceSeat } from './exchange';
import { ruleError } from './errors';
import { getLegalMoves } from './legalMoves';
import { defaultTeamOf, playerCountFor, SUPER_MURLAN } from './mode';
import { lockedMatchWinner, remainingFinishOrder, scoreHand } from './scoring';
import { nextSeat, nextUnfinishedSeat, seatCountOf, unfinishedSeats } from './seats';
import {
  GameState,
  isCombination,
  MatchMode,
  PublicPlayEvent,
  RuleError,
  SeatId,
} from './types';

export type CreateGameInput = {
  mode?: MatchMode;
  rules?: Partial<RulesConfig>;
  random: RandomSource;
};

function findThreeOfSpadesSeat(hands: GameState['hands']): SeatId | null {
  for (let seat = 0; seat < hands.length; seat += 1) {
    if (hands[seat]?.some(isThreeOfSpades)) {
      return seat as SeatId;
    }
  }
  return null;
}

function openingSeat(hands: GameState['hands'], rules: RulesConfig, dealerSeat: SeatId): SeatId {
  if (rules.firstLeadMustContainThreeOfSpades) {
    const holder = findThreeOfSpadesSeat(hands);
    if (holder !== null) {
      return holder;
    }
  }
  return nextSeat(dealerSeat, hands.length);
}

function emptyTrick(leaderSeat: SeatId): GameState['trick'] {
  return {
    leaderSeat,
    combination: null,
    lastSuccessfulSeat: null,
    passedSinceLastPlay: [],
  };
}

function dealNewHand(
  handIndex: number,
  rules: RulesConfig,
  random: RandomSource,
  previousFinishOrder: SeatId[],
  awaitReturnChoice: boolean,
  mode: MatchMode,
): Pick<
  GameState,
  'dealerSeat' | 'hands' | 'undealt' | 'currentSeat' | 'trick' | 'lastExchange' | 'pendingExchange' | 'phase'
> {
  const seatCount = playerCountFor(mode);
  const dealerSeat = dealerForHand(handIndex, seatCount);
  const raw =
    mode === 'super' ? shuffleDeck(createSuperDeck(random), random) : shuffleDeck(createDeck(), random);
  if (mode === 'super') {
    validateSuperDeck(raw);
  }
  const dealtCount =
    mode === 'super' ? seatCount * SUPER_MURLAN.cardsPerPlayer : raw.length;
  const shuffled = spiceDeck({
    deck: raw,
    dealerSeat,
    seatCount,
    dealtCount,
    random,
    teamOf: defaultTeamOf(mode),
  });
  const packed =
    mode === 'super'
      ? dealLimited(shuffled, dealerSeat, seatCount, SUPER_MURLAN.cardsPerPlayer)
      : { hands: dealCards(shuffled, dealerSeat, seatCount), undealt: [] as Card[] };
  if (
    mode !== 'super' &&
    packed.hands.some((hand) => hand.length > 14 || hand.length < 13)
  ) {
    packed.hands = dealCards(raw, dealerSeat, seatCount);
    packed.undealt = [];
  }
  packed.hands = limitStraightLength(packed.hands, 6, random);
  const firstSeat = previousFinishOrder[0] ?? null;
  const lastSeat = lastPlaceSeat(previousFinishOrder, seatCount);
  const exchanged = applyCardExchange(packed.hands, {
    enabled: rules.cardExchangeEnabled && handIndex > 0,
    firstSeat,
    lastSeat,
    awaitReturnChoice,
  });

  let leader: SeatId;
  let phase: GameState['phase'] = 'playing';
  if (handIndex === 0) {
    leader = openingSeat(exchanged.hands, rules, dealerSeat);
  } else if (exchanged.pending && firstSeat !== null) {
    leader = firstSeat;
    phase = 'exchanging';
  } else if (exchanged.exchange?.kind === 'skipped' && firstSeat !== null) {
    leader = firstSeat;
  } else if (exchanged.exchange?.kind === 'swap') {
    leader = exchanged.exchange.lastSeat;
  } else if (rules.laterHandOpener === 'previousFirstFinisher' && firstSeat !== null) {
    leader = firstSeat;
  } else {
    leader = nextSeat(dealerSeat, seatCount);
  }

  return {
    dealerSeat,
    hands: exchanged.hands,
    undealt: packed.undealt,
    currentSeat: leader,
    trick: emptyTrick(leader),
    lastExchange: exchanged.exchange,
    pendingExchange: exchanged.pending,
    phase,
  };
}

function resolveMode(mode?: MatchMode): MatchMode {
  if (mode === 'chaos' || mode === 'super') {
    return mode;
  }
  return '2v2';
}

export function createGame(input: CreateGameInput): GameState {
  const mode = resolveMode(input.mode);
  const rules = mergeRules(mode === 'super' ? { ...SUPER_RULES, ...input.rules } : input.rules);
  const dealt = dealNewHand(0, rules, input.random, [], false, mode);
  const seatCount = dealt.hands.length;
  return {
    schemaVersion: 1,
    mode,
    rules,
    handIndex: 0,
    dealerSeat: dealt.dealerSeat,
    hands: dealt.hands,
    teamOf: defaultTeamOf(mode),
    undealt: dealt.undealt,
    currentSeat: dealt.currentSeat,
    trick: dealt.trick,
    finishOrder: [],
    scores: Array.from({ length: seatCount }, () => 0),
    targetScore: rules.targetScore,
    phase: 'playing',
    history: [],
    winner: null,
    lastHandPoints: null,
    lastExchange: null,
    pendingExchange: null,
  };
}

function cardsInHand(hand: Card[], cards: Card[]): { missing: string[]; unique: boolean } {
  const remaining = new Map<string, number>();
  for (const card of hand) {
    remaining.set(card.id, (remaining.get(card.id) ?? 0) + 1);
  }
  const missing: string[] = [];
  const seen = new Set<string>();
  let unique = true;
  for (const card of cards) {
    if (seen.has(card.id)) {
      unique = false;
    }
    seen.add(card.id);
    const count = remaining.get(card.id) ?? 0;
    if (count <= 0) {
      missing.push(card.id);
    } else {
      remaining.set(card.id, count - 1);
    }
  }
  return { missing, unique };
}

function isFirstLeadOfFirstHand(state: GameState): boolean {
  return state.handIndex === 0 && !state.history.some((event) => event.kind === 'play');
}

function mustIncludeThreeOfSpades(state: GameState): boolean {
  return state.rules.firstLeadMustContainThreeOfSpades && isFirstLeadOfFirstHand(state);
}

export function legalMovesForSeat(state: GameState, seat: SeatId): Card[][] {
  return getLegalMoves(state.hands[seat] ?? [], state.trick, state.rules, {
    mustIncludeThreeOfSpades: mustIncludeThreeOfSpades(state),
  });
}

function completeHandIfNeeded(state: GameState): GameState {
  const locked = lockedMatchWinner(state);
  const needed = seatCountOf(state) - 1;
  if (state.finishOrder.length < needed && locked === null) {
    return state;
  }
  const remaining = remainingFinishOrder(state);
  const last = remaining[remaining.length - 1];
  if (
    last !== undefined &&
    last === state.extraTurnSeat &&
    !state.extraTurnUsed &&
    state.hands[last].length > 0
  ) {
    return {
      ...state,
      extraTurnUsed: true,
      currentSeat: last,
      trick: emptyTrick(last),
      phase: 'playing',
    };
  }
  const finishOrder = [...state.finishOrder, ...remainingFinishOrder(state)];
  const scored = scoreHand({ ...state, finishOrder }, state.rules);
  return {
    ...state,
    finishOrder,
    scores: scored.scores,
    targetScore: scored.targetScore,
    phase: scored.phase,
    winner: scored.winner,
    lastHandPoints: scored.pointsThisHand,
  };
}

function allOtherActivePassed(state: GameState, lastSuccessful: SeatId): boolean {
  const active = unfinishedSeats(state.finishOrder, seatCountOf(state));
  const others = active.filter((seat) => seat !== lastSuccessful);
  return others.every((seat) => state.trick.passedSinceLastPlay.includes(seat));
}

function closeTrick(state: GameState, winner: SeatId): GameState {
  const leader =
    state.hands[winner].length > 0
      ? winner
      : nextUnfinishedSeat(winner, state.finishOrder, seatCountOf(state));
  if (leader === null) {
    return completeHandIfNeeded(state);
  }
  const history: PublicPlayEvent[] = [...state.history, { kind: 'trickWon', seat: winner }];
  return {
    ...state,
    currentSeat: leader,
    trick: emptyTrick(leader),
    history,
  };
}

function advanceAfterAction(state: GameState): GameState {
  const next = nextUnfinishedSeat(state.currentSeat, state.finishOrder, seatCountOf(state));
  if (next === null) {
    return completeHandIfNeeded(state);
  }
  return { ...state, currentSeat: next };
}

export function applyPlay(
  state: GameState,
  playerId: SeatId,
  cards: Card[],
  rules: RulesConfig = state.rules,
): GameState | RuleError {
  if (state.phase === 'matchComplete') {
    return ruleError('matchComplete', 'The match is already over.');
  }
  if (state.phase !== 'playing') {
    return ruleError('wrongPhase', 'This hand is over.');
  }
  if (playerId !== state.currentSeat) {
    return ruleError('notYourTurn', 'It is not your turn.');
  }
  if (cards.length === 0) {
    return ruleError('emptyPlay', 'Play at least one card.');
  }

  const possession = cardsInHand(state.hands[playerId], cards);
  if (!possession.unique) {
    return ruleError('duplicateCards', 'Duplicate cards are not allowed.');
  }
  if (possession.missing.length > 0) {
    return ruleError('cardNotInHand', 'One or more cards are not in your hand.');
  }

  const detected = detectCombination(cards, rules);
  if (!isCombination(detected)) {
    return ruleError('invalidCombination', detected.reason);
  }

  if (mustIncludeThreeOfSpades(state) && !cards.some(isThreeOfSpades)) {
    return ruleError('mustIncludeThreeOfSpades', 'The first play of the match must include 3♠.');
  }

  const current = state.trick.combination;
  if (current && !canBeat(detected, current, rules)) {
    return ruleError('cannotBeat', describeCannotBeat(detected, current, rules));
  }

  const hands = cloneHands(state.hands);
  const playedIds = new Set(cards.map((card) => card.id));
  hands[playerId] = hands[playerId].filter((card) => !playedIds.has(card.id));

  const history: PublicPlayEvent[] = [
    ...state.history,
    { kind: 'play', seat: playerId, cards: detected.cards, combination: detected },
  ];

  let nextState: GameState = {
    ...state,
    rules,
    hands,
    history,
    trick: {
      leaderSeat: current ? state.trick.leaderSeat : playerId,
      combination: detected,
      lastSuccessfulSeat: playerId,
      passedSinceLastPlay: [],
    },
  };

  if (hands[playerId].length === 0) {
    const finishOrder = [...state.finishOrder, playerId];
    nextState = {
      ...nextState,
      finishOrder,
      history: [...history, { kind: 'finished', seat: playerId, place: finishOrder.length }],
    };
    nextState = completeHandIfNeeded(nextState);
    if (nextState.phase !== 'playing') {
      return nextState;
    }
  }

  const advanced = advanceAfterAction(nextState);
  if (
    Boolean(state.extraTurnUsed) &&
    advanced.extraTurnUsed &&
    advanced.finishOrder.length >= seatCountOf(advanced) - 1 &&
    advanced.phase === 'playing'
  ) {
    return completeHandIfNeeded(advanced);
  }
  return advanced;
}

export function applyPass(
  state: GameState,
  playerId: SeatId,
  rules: RulesConfig = state.rules,
): GameState | RuleError {
  if (state.phase === 'matchComplete') {
    return ruleError('matchComplete', 'The match is already over.');
  }
  if (state.phase !== 'playing') {
    return ruleError('wrongPhase', 'This hand is over.');
  }
  if (playerId !== state.currentSeat) {
    return ruleError('notYourTurn', 'It is not your turn.');
  }
  if (!state.trick.combination && !rules.allowPassOnLead) {
    return ruleError('cannotPassOnLead', 'You must lead a combination; passing on an empty trick is not allowed.');
  }

  const passedSinceLastPlay = rules.allowReentryAfterPass
    ? [...state.trick.passedSinceLastPlay, playerId]
    : [...new Set([...state.trick.passedSinceLastPlay, playerId])];

  let nextState: GameState = {
    ...state,
    rules,
    trick: { ...state.trick, passedSinceLastPlay },
    history: [...state.history, { kind: 'pass', seat: playerId }],
  };

  const lastSuccessful = nextState.trick.lastSuccessfulSeat;
  if (lastSuccessful !== null && allOtherActivePassed(nextState, lastSuccessful)) {
    return closeTrick(nextState, lastSuccessful);
  }

  if (!rules.allowReentryAfterPass) {
    const skip = new Set(passedSinceLastPlay);
    let seat = playerId;
    for (let i = 0; i < seatCountOf(nextState); i += 1) {
      const candidate = nextUnfinishedSeat(seat, nextState.finishOrder, seatCountOf(nextState));
      if (candidate === null) {
        break;
      }
      if (!skip.has(candidate) || candidate === lastSuccessful) {
        return { ...nextState, currentSeat: candidate };
      }
      seat = candidate;
    }
  }

  const advanced = advanceAfterAction(nextState);
  if (
    Boolean(state.extraTurnUsed) &&
    advanced.extraTurnUsed &&
    advanced.finishOrder.length >= seatCountOf(advanced) - 1 &&
    advanced.phase === 'playing'
  ) {
    return completeHandIfNeeded(advanced);
  }
  return advanced;
}

export function startNextHand(
  state: GameState,
  rules: RulesConfig = state.rules,
  random: RandomSource,
  options: { awaitReturnChoice?: boolean } = {},
): GameState | RuleError {
  if (state.phase === 'matchComplete') {
    return ruleError('matchComplete', 'The match is already over.');
  }
  if (state.phase !== 'handComplete') {
    return ruleError('wrongPhase', 'Finish the current hand before dealing the next one.');
  }

  const nextIndex = state.handIndex + 1;
  const dealt = dealNewHand(
    nextIndex,
    rules,
    random,
    state.finishOrder,
    Boolean(options.awaitReturnChoice),
    state.mode,
  );

  return {
    ...state,
    rules,
    handIndex: nextIndex,
    dealerSeat: dealt.dealerSeat,
    hands: dealt.hands,
    undealt: dealt.undealt,
    currentSeat: dealt.currentSeat,
    trick: dealt.trick,
    finishOrder: [],
    phase: dealt.phase,
    history: [],
    lastHandPoints: null,
    winner: null,
    lastExchange: dealt.lastExchange,
    pendingExchange: dealt.pendingExchange,
    scores: [...state.scores],
    targetScore: state.targetScore,
  };
}

export function completeExchangeReturn(
  state: GameState,
  playerId: SeatId,
  card: Card,
): GameState | RuleError {
  const pending = state.pendingExchange;
  if (state.phase !== 'exchanging' || !pending) {
    return ruleError('wrongPhase', 'There is no card exchange in progress.');
  }
  if (playerId !== pending.firstSeat) {
    return ruleError('notYourTurn', 'Only first place chooses the card to give.');
  }
  if (card.id === pending.givenToFirst.id) {
    return ruleError('invalidExchangeCard', 'You cannot give back the card you just received.');
  }
  const possession = cardsInHand(state.hands[playerId], [card]);
  if (possession.missing.length > 0) {
    return ruleError('cardNotInHand', 'That card is not in your hand.');
  }

  const finished = finishCardExchange(state.hands, pending, card);
  const leader = pending.lastSeat;
  return {
    ...state,
    hands: finished.hands,
    lastExchange: finished.exchange,
    pendingExchange: null,
    phase: 'playing',
    currentSeat: leader,
    trick: emptyTrick(leader),
  };
}

export function autoCompleteExchange(state: GameState): GameState | RuleError {
  const pending = state.pendingExchange;
  if (state.phase !== 'exchanging' || !pending) {
    return state;
  }
  const card = defaultReturnCard(state.hands[pending.firstSeat], pending.givenToFirst.id);
  return completeExchangeReturn(state, pending.firstSeat, card);
}

export function explainExchangeSelection(state: GameState, seat: SeatId, cards: Card[]): string | null {
  const pending = state.pendingExchange;
  if (state.phase !== 'exchanging' || !pending) {
    return 'There is no card exchange in progress.';
  }
  if (seat !== pending.firstSeat) {
    return 'Only first place chooses the card to give.';
  }
  if (cards.length === 0) {
    return null;
  }
  if (cards.length !== 1) {
    return 'Choose one card to give to last place.';
  }
  const card = cards[0]!;
  if (card.id === pending.givenToFirst.id) {
    return 'You cannot give back the card you just received.';
  }
  const possession = cardsInHand(state.hands[seat], [card]);
  if (possession.missing.length > 0) {
    return 'That card is not in your hand.';
  }
  return null;
}

export function explainSelection(state: GameState, seat: SeatId, cards: Card[]): string | null {
  if (cards.length === 0) {
    return null;
  }
  const possession = cardsInHand(state.hands[seat], cards);
  if (!possession.unique || possession.missing.length > 0) {
    return 'One or more cards are not in your hand.';
  }
  const detected = detectCombination(cards, state.rules);
  if (!isCombination(detected)) {
    return detected.reason;
  }
  if (mustIncludeThreeOfSpades(state) && !cards.some(isThreeOfSpades)) {
    return 'The first play of the match must include 3♠.';
  }
  const current = state.trick.combination;
  if (current && !canBeat(detected, current, state.rules)) {
    return describeCannotBeat(detected, current, state.rules);
  }
  return null;
}

export function describePlay(combination: ReturnType<typeof detectCombination>): string {
  if (!isCombination(combination)) {
    return combination.reason;
  }
  return combinationLabel(combination);
}
