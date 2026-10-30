import { sortHand } from '../cards/strength';
import { BotView, GameState, PublicMatchView, PublicPlayEvent, SeatId } from './types';
import { teamScores } from './scoring';

export function lastPlayedSeatFromHistory(history: PublicPlayEvent[]): SeatId | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const event = history[index];
    if (event?.kind === 'play') {
      return event.seat;
    }
  }
  return null;
}

export function toPublicView(state: GameState, viewerSeat: SeatId): PublicMatchView {
  return {
    mode: state.mode,
    viewerSeat,
    ownHand: sortHand(state.hands[viewerSeat]),
    cardCounts: [
      state.hands[0].length,
      state.hands[1].length,
      state.hands[2].length,
      state.hands[3].length,
    ],
    currentSeat: state.currentSeat,
    trick: {
      leaderSeat: state.trick.leaderSeat,
      combination: state.trick.combination,
      lastSuccessfulSeat: state.trick.lastSuccessfulSeat,
      passedSinceLastPlay: [...state.trick.passedSinceLastPlay],
    },
    scores: [...state.scores],
    teamScores: state.mode === '2v2' ? teamScores(state.scores) : null,
    finishOrder: [...state.finishOrder],
    phase: state.phase,
    targetScore: state.targetScore,
    handIndex: state.handIndex,
    winner: state.winner,
    lastHandPoints: state.lastHandPoints,
    lastExchange: state.lastExchange ?? null,
    pendingExchange: state.pendingExchange ?? null,
    cardExchangeEnabled: state.rules.cardExchangeEnabled,
    history: [...state.history],
  };
}

export function toBotView(state: GameState, seat: SeatId): BotView {
  return {
    seat,
    hand: sortHand(state.hands[seat]),
    cardCounts: [
      state.hands[0].length,
      state.hands[1].length,
      state.hands[2].length,
      state.hands[3].length,
    ],
    currentSeat: state.currentSeat,
    trick: {
      leaderSeat: state.trick.leaderSeat,
      combination: state.trick.combination,
      lastSuccessfulSeat: state.trick.lastSuccessfulSeat,
      passedSinceLastPlay: [...state.trick.passedSinceLastPlay],
    },
    finishOrder: [...state.finishOrder],
    scores: [...state.scores],
    history: [...state.history],
    mode: state.mode,
    rules: state.rules,
    phase: state.phase,
    handIndex: state.handIndex,
  };
}
