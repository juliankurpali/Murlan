import { sortHand } from '../cards/strength';
import { BotView, GameState, PublicMatchView, PublicPlayEvent, SeatId } from './types';
import { defaultTeamOf } from './mode';
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

export type TrickPlayEvent = Extract<PublicPlayEvent, { kind: 'play' }>;

export function currentTrickPlays(history: PublicPlayEvent[]): TrickPlayEvent[] {
  const plays: TrickPlayEvent[] = [];
  for (const event of history) {
    if (event.kind === 'trickWon') {
      plays.length = 0;
      continue;
    }
    if (event.kind === 'play') {
      plays.push(event);
    }
  }
  return plays;
}

export function toPublicView(state: GameState, viewerSeat: SeatId): PublicMatchView {
  const teamOf = state.teamOf ?? defaultTeamOf(state.mode);
  return {
    mode: state.mode,
    viewerSeat,
    ownHand: sortHand(state.hands[viewerSeat] ?? []),
    cardCounts: state.hands.map((hand) => hand.length),
    currentSeat: state.currentSeat,
    trick: {
      leaderSeat: state.trick.leaderSeat,
      combination: state.trick.combination,
      lastSuccessfulSeat: state.trick.lastSuccessfulSeat,
      passedSinceLastPlay: [...state.trick.passedSinceLastPlay],
    },
    scores: [...state.scores],
    teamScores: teamScores(state.scores, teamOf),
    teamOf: [...teamOf],
    finishOrder: [...state.finishOrder],
    phase: state.phase,
    targetScore: state.targetScore,
    handIndex: state.handIndex,
    winner: state.winner,
    lastHandPoints: state.lastHandPoints,
    lastExchange: state.lastExchange ?? null,
    pendingExchange: state.pendingExchange ?? null,
    cardExchangeEnabled: state.rules.cardExchangeEnabled,
    undealtCount: state.undealt?.length ?? 0,
    history: [...state.history],
  };
}

export function toBotView(state: GameState, seat: SeatId): BotView {
  return {
    seat,
    hand: sortHand(state.hands[seat] ?? []),
    cardCounts: state.hands.map((hand) => hand.length),
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
