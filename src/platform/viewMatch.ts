import { Card, DEFAULT_RULES, GameState, PublicMatchView, SeatId } from '../domain';

function hiddenCards(seat: SeatId, count: number): Card[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `hidden-${seat}-${index}`,
    kind: 'standard',
    suit: 'spades',
    rank: 3,
  }));
}

export function matchFromView(view: PublicMatchView): GameState {
  const hands: GameState['hands'] = [
    hiddenCards(0, view.cardCounts[0]),
    hiddenCards(1, view.cardCounts[1]),
    hiddenCards(2, view.cardCounts[2]),
    hiddenCards(3, view.cardCounts[3]),
  ];
  hands[view.viewerSeat] = view.ownHand;
  return {
    schemaVersion: 1,
    mode: view.mode,
    rules: { ...DEFAULT_RULES, cardExchangeEnabled: view.cardExchangeEnabled },
    handIndex: view.handIndex,
    dealerSeat: 0,
    hands,
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
