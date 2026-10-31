import { Card, StandardCard } from '../cards/types';
import { cardStrength } from '../cards/strength';
import { RulesConfig } from '../rules/types';
import {
  Combination,
  DetectedCombination,
  InvalidCombination,
  SequenceKind,
} from './types';

function invalid(reason: string): InvalidCombination {
  return { type: 'invalid', reason };
}

function allStandard(cards: Card[]): cards is StandardCard[] {
  return cards.every((card) => card.kind === 'standard');
}

function uniqueIds(cards: Card[]): boolean {
  return new Set(cards.map((card) => card.id)).size === cards.length;
}

function combo(
  type: Combination['type'],
  cards: Card[],
  strength: number,
  sequence?: SequenceKind,
): Combination {
  return {
    type,
    cards: [...cards],
    strength,
    length: cards.length,
    sequence,
  };
}

/** Straight order: 2-3-4-…-K-A. 2 is still the strongest single, but in a scale it is 2. */
export function highStraightRank(card: StandardCard, rules: RulesConfig): number | null {
  if (card.rank === 15) {
    return 2;
  }
  if (card.rank === 14 && !rules.aceHighStraightEnabled) {
    return null;
  }
  return card.rank;
}

/** Ace-low scale: A=1, then 2-3-4-…. Ace cannot also be high in the same play. */
export function aceLowStraightRank(card: StandardCard): number {
  if (card.rank === 14) {
    return 1;
  }
  if (card.rank === 15) {
    return 2;
  }
  return card.rank;
}

function isConsecutive(values: number[]): boolean {
  if (values.length === 0) {
    return false;
  }
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (prev === undefined || current === undefined || current !== prev + 1) {
      return false;
    }
  }
  return true;
}

type SequenceRead = { strength: number; kind: SequenceKind };

function readSequence(cards: StandardCard[], rules: RulesConfig): SequenceRead | null {
  if (new Set(cards.map((card) => card.rank)).size !== cards.length) {
    return null;
  }

  const highValues = cards.map((card) => highStraightRank(card, rules));
  if (highValues.every((value): value is number => value !== null) && isConsecutive(highValues)) {
    return { strength: Math.max(...highValues), kind: 'high' };
  }

  if (!rules.aceLowStraightEnabled) {
    return null;
  }

  const hasAce = cards.some((card) => card.rank === 14);
  const hasTwo = cards.some((card) => card.rank === 15);
  if (!hasAce || !hasTwo) {
    return null;
  }

  const lowValues = cards.map(aceLowStraightRank);
  if (isConsecutive(lowValues)) {
    return { strength: Math.max(...lowValues), kind: 'aceLow' };
  }

  return null;
}

function sameSuit(cards: StandardCard[]): boolean {
  const suit = cards[0]?.suit;
  return suit !== undefined && cards.every((card) => card.suit === suit);
}

export function detectCombination(cards: Card[], rules: RulesConfig): DetectedCombination {
  if (cards.length === 0) {
    return invalid('Play at least one card.');
  }
  if (!uniqueIds(cards)) {
    return invalid('Duplicate cards are not allowed.');
  }

  if (cards.length === 1) {
    const only = cards[0];
    if (!only) {
      return invalid('Play at least one card.');
    }
    return combo('single', cards, cardStrength(only));
  }

  if (cards.some((card) => card.kind === 'joker')) {
    return invalid('Jokers may only be played as singles.');
  }

  if (!allStandard(cards)) {
    return invalid('Invalid combination.');
  }

  const firstRank = cards[0]?.rank;
  if (firstRank !== undefined && cards.every((card) => card.rank === firstRank)) {
    if (cards.length === 2) {
      return combo('pair', cards, firstRank);
    }
    if (cards.length === 3) {
      return combo('triple', cards, firstRank);
    }
    if (cards.length === 4) {
      return combo('bomb', cards, firstRank);
    }
    return invalid('Equal-rank plays must be a pair, triple, or bomb.');
  }

  if (cards.length < 5) {
    return invalid('Straights and flushes need at least five cards.');
  }

  const sequence = readSequence(cards, rules);
  if (!sequence) {
    return invalid('Cards are not a valid consecutive sequence.');
  }

  if (sameSuit(cards)) {
    if (rules.flushEnabled) {
      return combo('flush', cards, sequence.strength, sequence.kind);
    }
    return combo('straight', cards, sequence.strength, sequence.kind);
  }

  return combo('straight', cards, sequence.strength, sequence.kind);
}

export function combinationLabel(combination: Combination): string {
  switch (combination.type) {
    case 'single':
      return 'single';
    case 'pair':
      return 'pair';
    case 'triple':
      return 'triple';
    case 'straight':
      return `straight of ${combination.length}`;
    case 'bomb':
      return 'bomb';
    case 'flush':
      return `flush of ${combination.length}`;
    default:
      return combination.type;
  }
}
