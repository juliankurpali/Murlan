import { createDeck } from '../cards/deck';
import { RandomSource } from '../cards/random';
import { shuffleDeck } from '../cards/shuffle';
import { Card, THREE_OF_SPADES_ID } from '../cards/types';
import { mergeRules } from '../rules/defaults';
import { RulesConfig } from '../rules/types';
import { canBeat, describeCannotBeat } from './beating';
import { combinationLabel, detectCombination } from './combinations';
import { dealCards, dealerForHand } from './deal';
import { applyCardExchange, defaultReturnCard, finishCardExchange, lastPlaceSeat } from './exchange';
import { ruleError } from './errors';
import { getLegalMoves } from './legalMoves';
import { lockedMatchWinner, remainingFinishOrder, scoreHand } from './scoring';
import { nextSeat, nextUnfinishedSeat, unfinishedSeats } from './seats';
import {
  GameState,
  isCombination,
  MatchMode,
  PublicPlayEvent,
  RuleError,
  SeatId,
  SEATS,
} from './types';

export type CreateGameInput = {
  mode?: MatchMode;
  rules?: Partial<RulesConfig>;
  random: RandomSource;
};

function cloneHands(hands: GameState['hands']): GameState['hands'] {
  return [hands[0].slice(), hands[1].slice(), hands[2].slice(), hands[3].slice()];
}

function findCardSeat(hands: GameState['hands'], cardId: string): SeatId | null {
  for (const seat of SEATS) {
    if (hands[seat].some((card) => card.id === cardId)) {
      return seat;
    }
  }
  return null;
}

function openingSeat(hands: GameState['hands'], rules: RulesConfig, dealerSeat: SeatId): SeatId {
  if (rules.firstLeadMustContainThreeOfSpades) {
    const holder = findCardSeat(hands, THREE_OF_SPADES_ID);
    if (holder !== null) {
      return holder;
    }
  }
  return nextSeat(dealerSeat);
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
): Pick<
  GameState,
  'dealerSeat' | 'hands' | 'currentSeat' | 'trick' | 'lastExchange' | 'pendingExchange' | 'phase'
> {
  const dealerSeat = dealerForHand(handIndex);
  const shuffled = shuffleDeck(createDeck(), random);
  const dealt = dealCards(shuffled, dealerSeat);
  const firstSeat = previousFinishOrder[0] ?? null;
  const lastSeat = lastPlaceSeat(previousFinishOrder);
  const exchanged = applyCardExchange(dealt, {
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
    leader = nextSeat(dealerSeat);
  }

  return {
    dealerSeat,
    hands: exchanged.hands,
    currentSeat: leader,
    trick: emptyTrick(leader),
    lastExchange: exchanged.exchange,
    pendingExchange: exchanged.pending,
    phase,
  };
}

export function createGame(input: CreateGameInput): GameState {
  const rules = mergeRules(input.rules);
  const dealt = dealNewHand(0, rules, input.random, [], false);
  return {
    schemaVersion: 1,
    mode: '2v2',
    rules,
    handIndex: 0,
    dealerSeat: dealt.dealerSeat,
    hands: dealt.hands,
    currentSeat: dealt.currentSeat,
    trick: dealt.trick,
    finishOrder: [],
    scores: [0, 0, 0, 0],
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
  return getLegalMoves(state.hands[seat], state.trick, state.rules, {
    mustIncludeCardId: mustIncludeThreeOfSpades(state) ? THREE_OF_SPADES_ID : undefined,
  });
}

function completeHandIfNeeded(state: GameState): GameState {
  const locked = lockedMatchWinner(state);
  if (state.finishOrder.length < 3 && locked === null) {
    return state;
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
  const active = unfinishedSeats(state.finishOrder);
  const others = active.filter((seat) => seat !== lastSuccessful);
  return others.every((seat) => state.trick.passedSinceLastPlay.includes(seat));
}

function closeTrick(state: GameState, winner: SeatId): GameState {
  const leader =
    state.hands[winner].length > 0 ? winner : nextUnfinishedSeat(winner, state.finishOrder);
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
  const next = nextUnfinishedSeat(state.currentSeat, state.finishOrder);
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

  if (mustIncludeThreeOfSpades(state) && !cards.some((card) => card.id === THREE_OF_SPADES_ID)) {
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
    { kind: 'play', seat: playerId, cards, combination: detected },
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

  return advanceAfterAction(nextState);
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
    for (let i = 0; i < 4; i += 1) {
      const candidate = nextUnfinishedSeat(seat, nextState.finishOrder);
      if (candidate === null) {
        break;
      }
      if (!skip.has(candidate) || candidate === lastSuccessful) {
        return { ...nextState, currentSeat: candidate };
      }
      seat = candidate;
    }
  }

  return advanceAfterAction(nextState);
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
  const dealt = dealNewHand(nextIndex, rules, random, state.finishOrder, Boolean(options.awaitReturnChoice));

  return {
    ...state,
    rules,
    handIndex: nextIndex,
    dealerSeat: dealt.dealerSeat,
    hands: dealt.hands,
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
  if (mustIncludeThreeOfSpades(state) && !cards.some((card) => card.id === THREE_OF_SPADES_ID)) {
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
