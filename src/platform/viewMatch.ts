import { Card, DEFAULT_RULES, GameState, PublicMatchView, SUPER_RULES, SeatId, defaultTeamOf } from '../domain';

function hiddenCards(seat: SeatId, count: number): Card[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `hidden-${seat}-${index}`,
    kind: 'standard',
    suit: 'spades',
    rank: 3,
  }));
}

export function matchFromView(view: PublicMatchView): GameState {
  const hands = view.cardCounts.map((count, seat) => hiddenCards(seat as SeatId, count));
  hands[view.viewerSeat] = view.ownHand;
  return {
    schemaVersion: 1,
    mode: view.mode,
    rules: {
      ...DEFAULT_RULES,
      ...(view.mode === 'super' ? SUPER_RULES : {}),
      cardExchangeEnabled: view.cardExchangeEnabled,
    },
    handIndex: view.handIndex,
    dealerSeat: 0,
    hands,
    teamOf: view.teamOf ?? defaultTeamOf(view.mode),
    undealt: Array.from({ length: view.undealtCount ?? 0 }, (_, index) => ({
      id: `undealt-${index}`,
      kind: 'standard' as const,
      suit: 'spades' as const,
      rank: 3 as const,
    })),
    currentSeat: view.currentSeat,
    trick: view.trick,
    finishOrder: view.finishOrder,
    scores: view.scores,
    targetScore: view.targetScore,
    phase: view.phase,
    history: view.history,
    winner: view.winner,
    lastHandPoints: view.lastHandPoints,
    lastExchange: view.lastExchange,
    pendingExchange: view.pendingExchange,
  };
}
