import { Card, Suit } from './types';

const RANK_LABEL: Record<number, string> = {
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

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export function formatCard(card: Card): string {
  if (card.kind === 'joker') {
    return card.color === 'black' ? 'Black Joker' : 'Red Joker';
  }
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`;
}

export function formatCardShort(card: Card): string {
  if (card.kind === 'joker') {
    return card.color === 'black' ? 'BJ' : 'RJ';
  }
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`;
}
