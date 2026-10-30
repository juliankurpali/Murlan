import { Card, StandardRank, SUIT_ORDER } from './types';

/** Rank order: 3 < … < 2 < black joker < red joker */
export function cardStrength(card: Card): number {
  if (card.kind === 'joker') {
    return card.color === 'black' ? 16 : 17;
  }
  return card.rank;
}

export function rankStrength(rank: StandardRank): number {
  return rank;
}

export function compareCards(a: Card, b: Card): number {
  const byStrength = cardStrength(a) - cardStrength(b);
  if (byStrength !== 0) {
    return byStrength;
  }
  if (a.kind === 'standard' && b.kind === 'standard') {
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  }
  return a.id.localeCompare(b.id);
}

export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort(compareCards);
}
