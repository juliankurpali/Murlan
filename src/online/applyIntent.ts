import { nextHand, submitExchange, submitPass, submitPlay } from '../application';
import { Card, GameState, mathRandomSource, RuleError, SeatId } from '../domain';

function missingCard(): RuleError {
  return { type: 'RuleError', code: 'cardNotInHand', message: 'Card is not in that hand.' };
}

export function applyNetworkIntent(
  state: GameState,
  seat: SeatId,
  intent: { kind: 'play' | 'pass' | 'exchange' | 'nextHand'; cards?: string[]; cardId?: string },
  botSeats: readonly number[],
): GameState | RuleError {
  if (intent.kind === 'nextHand') {
    return nextHand(state, mathRandomSource(), botSeats);
  }
  if (intent.kind === 'pass') {
    return submitPass(state, seat);
  }
  if (intent.kind === 'exchange') {
    const card = state.hands[seat]?.find((item) => item.id === intent.cardId);
    if (!card) {
      return missingCard();
    }
    return submitExchange(state, card, seat);
  }
  const cards: Card[] = [];
  for (const id of intent.cards ?? []) {
    const card = state.hands[seat]?.find((item) => item.id === id);
    if (!card) {
      return missingCard();
    }
    cards.push(card);
  }
  return submitPlay(state, cards, seat);
}
