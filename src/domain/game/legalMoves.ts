import { Card, StandardCard, StandardRank } from '../cards/types';
import { RulesConfig } from '../rules/types';
import { canBeat } from './beating';
import { detectCombination } from './combinations';
import { Combination, TrickState } from './types';
import { isCombination } from './types';

function combinationsOf<T>(items: T[], k: number): T[][] {
  if (k === 0) {
    return [[]];
  }
  if (k > items.length) {
    return [];
  }
  const result: T[][] = [];
  const choose = (start: number, chosen: T[]) => {
    if (chosen.length === k) {
      result.push([...chosen]);
      return;
    }
    const remainingNeeded = k - chosen.length;
    for (let i = start; i <= items.length - remainingNeeded; i += 1) {
      const item = items[i];
      if (item === undefined) {
        continue;
      }
      chosen.push(item);
      choose(i + 1, chosen);
      chosen.pop();
    }
  };
  choose(0, []);
  return result;
}

function cartesian<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>(
    (acc, group) => acc.flatMap((prefix) => group.map((item) => [...prefix, item])),
    [[]],
  );
}

function standardCards(hand: Card[]): StandardCard[] {
  return hand.filter((card): card is StandardCard => card.kind === 'standard');
}

function groupByRank(cards: StandardCard[]): Map<StandardRank, StandardCard[]> {
  const groups = new Map<StandardRank, StandardCard[]>();
  for (const card of cards) {
    const list = groups.get(card.rank) ?? [];
    list.push(card);
    groups.set(card.rank, list);
  }
  return groups;
}

function generateRankSets(hand: Card[], size: 2 | 3 | 4): Card[][] {
  const groups = groupByRank(standardCards(hand));
  const moves: Card[][] = [];
  for (const cards of groups.values()) {
    if (cards.length >= size) {
      moves.push(...combinationsOf(cards, size));
    }
  }
  return moves;
}

function consecutiveWindows(values: number[], minLength: number): number[][] {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  const windows: number[][] = [];
  let run: number[] = [];
  for (const value of unique) {
    const last = run[run.length - 1];
    if (last === undefined || value === last + 1) {
      run.push(value);
    } else {
      run = [value];
    }
    if (run.length >= minLength) {
      for (let length = minLength; length <= run.length; length += 1) {
        windows.push(run.slice(run.length - length));
      }
    }
  }
  return windows;
}

function generateFromRankWindows(
  rankGroups: Map<number, StandardCard[]>,
  windows: number[][],
): Card[][] {
  const moves: Card[][] = [];
  for (const window of windows) {
    const groups = window.map((rank) => rankGroups.get(rank) ?? []);
    if (groups.some((group) => group.length === 0)) {
      continue;
    }
    moves.push(...cartesian(groups));
  }
  return moves;
}

function generateStraightsAndFlushes(hand: Card[], rules: RulesConfig): Card[][] {
  const cards = standardCards(hand);
  const byRank = new Map<number, StandardCard[]>();
  for (const card of cards) {
    if (card.rank === 15) {
      continue;
    }
    if (card.rank === 14 && !rules.aceHighStraightEnabled) {
      continue;
    }
    const list = byRank.get(card.rank) ?? [];
    list.push(card);
    byRank.set(card.rank, list);
  }

  const highWindows = consecutiveWindows([...byRank.keys()], 5);
  const moves = generateFromRankWindows(byRank, highWindows);

  if (rules.aceLowStraightEnabled) {
    const lowByRank = new Map<number, StandardCard[]>();
    for (const card of cards) {
      let value: number;
      if (card.rank === 14) {
        value = 1;
      } else if (card.rank === 15) {
        value = 2;
      } else {
        value = card.rank;
      }
      const list = lowByRank.get(value) ?? [];
      list.push(card);
      lowByRank.set(value, list);
    }
    const hasAce = lowByRank.has(1);
    const hasTwo = lowByRank.has(2);
    if (hasAce && hasTwo) {
      const lowWindows = consecutiveWindows([...lowByRank.keys()], 5).filter((window) =>
        window.includes(1) && window.includes(2),
      );
      moves.push(...generateFromRankWindows(lowByRank, lowWindows));
    }
  }

  const unique = new Map<string, Card[]>();
  for (const move of moves) {
    const detected = detectCombination(move, rules);
    if (!isCombination(detected)) {
      continue;
    }
    if (detected.type !== 'straight' && detected.type !== 'flush') {
      continue;
    }
    const key = move
      .map((card) => card.id)
      .sort()
      .join(',');
    unique.set(key, move);
  }
  return [...unique.values()];
}

function generateAllCombinations(hand: Card[], rules: RulesConfig): Card[][] {
  const singles = hand.map((card) => [card]);
  const pairs = generateRankSets(hand, 2);
  const triples = generateRankSets(hand, 3);
  const bombs = generateRankSets(hand, 4);
  const sequences = generateStraightsAndFlushes(hand, rules);
  return [...singles, ...pairs, ...triples, ...bombs, ...sequences];
}

export type LegalMoveContext = {
  mustIncludeCardId?: string;
};

export function getLegalMoves(
  hand: Card[],
  currentTrick: TrickState,
  rules: RulesConfig,
  context: LegalMoveContext = {},
): Card[][] {
  const generated = generateAllCombinations(hand, rules);
  const current = currentTrick.combination;
  const requiredId = context.mustIncludeCardId;

  return generated.filter((cards) => {
    if (requiredId && !cards.some((card) => card.id === requiredId)) {
      return false;
    }
    const detected = detectCombination(cards, rules);
    if (!isCombination(detected)) {
      return false;
    }
    if (!current) {
      return true;
    }
    return canBeat(detected, current, rules);
  });
}

export function isLegalCardSet(legalMoves: Card[][], cards: Card[]): boolean {
  const key = [...cards.map((card) => card.id)].sort().join(',');
  return legalMoves.some(
    (move) =>
      [...move.map((card) => card.id)].sort().join(',') === key,
  );
}

export function findMatchingLegalMove(
  legalMoves: Card[][],
  cards: Card[],
): Card[] | undefined {
  const key = [...cards.map((card) => card.id)].sort().join(',');
  return legalMoves.find(
    (move) => [...move.map((card) => card.id)].sort().join(',') === key,
  );
}

export function combinationFromCards(
  cards: Card[],
  rules: RulesConfig,
): Combination | null {
  const detected = detectCombination(cards, rules);
  return isCombination(detected) ? detected : null;
}
