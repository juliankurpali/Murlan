export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

/** 3–10, J=11, Q=12, K=13, A=14, 2=15 */
export const STANDARD_RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export type StandardRank = (typeof STANDARD_RANKS)[number];

export type JokerColor = 'black' | 'red';

export type StandardCard = {
  id: string;
  kind: 'standard';
  suit: Suit;
  rank: StandardRank;
};

export type JokerCard = {
  id: string;
  kind: 'joker';
  color: JokerColor;
};

export type Card = StandardCard | JokerCard;

export const THREE_OF_SPADES_ID = 'S3';
export const BLACK_JOKER_ID = 'JB';
export const RED_JOKER_ID = 'JR';

export const SUIT_ORDER: Record<Suit, number> = {
  spades: 0,
  hearts: 1,
  diamonds: 2,
  clubs: 3,
};
