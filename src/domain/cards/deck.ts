import { RandomSource } from './random';
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

/** Classic face-art key. Super copies use ids like `S3#0` / `JB#1`. */
export function faceArtId(card: Card): string {
  if (card.kind === 'joker') {
    return card.color === 'black' ? 'JB' : 'JR';
  }
  return standardCardId(card.suit, card.rank);
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

function pickSuit(random: RandomSource): Suit {
  return SUITS[Math.floor(random.next() * SUITS.length)] ?? 'spades';
}

export function createSuperDeck(random: RandomSource): Card[] {
  const cards: Card[] = [];
  for (const rank of STANDARD_RANKS) {
    const suits: Suit[] = [...SUITS, pickSuit(random), pickSuit(random)];
    suits.forEach((suit, copy) => {
      cards.push({
        id: `${SUIT_ID[suit]}${RANK_ID[rank]}#${copy}`,
        kind: 'standard',
        suit,
        rank,
      });
    });
  }
  cards.push({ id: 'JB#0', kind: 'joker', color: 'black' });
  cards.push({ id: 'JB#1', kind: 'joker', color: 'black' });
  cards.push({ id: 'JR#0', kind: 'joker', color: 'red' });
  cards.push({ id: 'JR#1', kind: 'joker', color: 'red' });
  return cards;
}

export function validateSuperDeck(cards: Card[]): void {
  if (cards.length !== 82) {
    throw new Error(`super-deck-size:${cards.length}`);
  }
  const ids = cards.map((card) => card.id);
  if (new Set(ids).size !== cards.length) {
    throw new Error('super-deck-duplicate-id');
  }
  const ranks = new Map<number, number>();
  let black = 0;
  let red = 0;
  for (const card of cards) {
    if (card.kind === 'joker') {
      if (card.color === 'black') {
        black += 1;
      } else {
        red += 1;
      }
      continue;
    }
    if (!STANDARD_RANKS.includes(card.rank) || !SUITS.includes(card.suit)) {
      throw new Error(`super-deck-invalid:${card.id}`);
    }
    ranks.set(card.rank, (ranks.get(card.rank) ?? 0) + 1);
  }
  for (const rank of STANDARD_RANKS) {
    if (ranks.get(rank) !== 6) {
      throw new Error(`super-deck-rank:${rank}`);
    }
  }
  if (black !== 2 || red !== 2) {
    throw new Error(`super-deck-jokers:${black}:${red}`);
  }
}
