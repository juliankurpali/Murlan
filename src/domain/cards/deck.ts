import { Card, StandardRank, SUITS, STANDARD_RANKS, Suit } from './types';

const RANK_ID: Record<number, string> = {
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
};

const SUIT_ID: Record<Suit, string> = {
  spades: 'S',
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
};

export function standardCardId(suit: Suit, rank: StandardRank): string {
  return `${SUIT_ID[suit]}${RANK_ID[rank]}`;
}

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of STANDARD_RANKS) {
      cards.push({
        id: standardCardId(suit, rank),
        kind: 'standard',
        suit,
        rank,
      });
    }
  }
  cards.push({ id: 'JB', kind: 'joker', color: 'black' });
  cards.push({ id: 'JR', kind: 'joker', color: 'red' });
  return cards;
}

export function cardById(deck: Card[], id: string): Card {
  const card = deck.find((item) => item.id === id);
  if (!card) {
    throw new Error(`Card not found: ${id}`);
  }
  return card;
}
