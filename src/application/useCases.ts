import {
  applyPass,
  applyPlay,
  autoCompleteExchange,
  BotAction,
  Card,
  chooseBotAction,
  completeExchangeReturn,
  createGame,
  GameState,
  isRuleError,
  legalMovesForSeat,
  mathRandomSource,
  RandomSource,
  RuleError,
  SeatId,
  startNextHand,
  toBotView,
} from '../domain';
import { HUMAN_SEAT } from './types';

export function startMatch(random: RandomSource = mathRandomSource()): GameState {
  return createGame({ random });
}

export function submitPlay(
  state: GameState,
  cards: Card[],
  seat: SeatId = HUMAN_SEAT,
): GameState | RuleError {
  return applyPlay(state, seat, cards);
}

export function submitPass(state: GameState, seat: SeatId = HUMAN_SEAT): GameState | RuleError {
  return applyPass(state, seat);
}

export function isBotTurn(
  state: GameState,
  humanSeat: SeatId = HUMAN_SEAT,
  botSeats?: readonly number[],
): boolean {
  if (state.phase !== 'playing') {
    return false;
  }
  if (botSeats) {
    return botSeats.includes(state.currentSeat);
  }
  return state.currentSeat !== humanSeat;
}

export function peekBotAction(
  state: GameState,
  humanSeat: SeatId = HUMAN_SEAT,
  botSeats?: readonly number[],
): BotAction | null {
  if (!isBotTurn(state, humanSeat, botSeats)) {
    return null;
  }
  return chooseBotAction(toBotView(state, state.currentSeat), state.rules);
}

export function submitExchange(
  state: GameState,
  card: Card,
  seat: SeatId = HUMAN_SEAT,
): GameState | RuleError {
  return completeExchangeReturn(state, seat, card);
}

export function applyAutoTurn(state: GameState, seat: SeatId = state.currentSeat): GameState | RuleError {
  if (state.phase === 'exchanging') {
    return autoCompleteExchange(state);
  }
  if (state.phase !== 'playing' || state.currentSeat !== seat) {
    return state;
  }
  const view = toBotView(state, seat);
  const action = chooseBotAction(view, state.rules);
  if (action.type === 'play') {
    return applyPlay(state, seat, action.cards);
  }
  const passed = applyPass(state, seat);
  if (isRuleError(passed) && passed.code === 'cannotPassOnLead') {
    const moves = legalMovesForSeat(state, seat);
    const fallback = moves[0];
    if (fallback) {
      return applyPlay(state, seat, fallback);
    }
  }
  return passed;
}

export function applyBotTurn(
  state: GameState,
  humanSeat: SeatId = HUMAN_SEAT,
  botSeats?: readonly number[],
): GameState | RuleError {
  if (!isBotTurn(state, humanSeat, botSeats)) {
    return state;
  }
  return applyAutoTurn(state, state.currentSeat);
}

export function nextHand(
  state: GameState,
  random: RandomSource = mathRandomSource(),
  botSeats: readonly number[] = [1, 2, 3],
): GameState | RuleError {
  const firstSeat = state.finishOrder[0] ?? null;
  return startNextHand(state, state.rules, random, {
    awaitReturnChoice: firstSeat !== null && !botSeats.includes(firstSeat),
  });
}

export function matchIsUnfinished(state: GameState | null): boolean {
  return state !== null && state.phase !== 'matchComplete';
}
