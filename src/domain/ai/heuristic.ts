import { Card, THREE_OF_SPADES_ID } from '../cards/types';
import { RulesConfig } from '../rules/types';
import { detectCombination } from '../game/combinations';
import { getLegalMoves } from '../game/legalMoves';
import { BotView, Combination, isCombination } from '../game/types';

export type BotAction = { type: 'play'; cards: Card[] } | { type: 'pass' };

function combinationOf(cards: Card[], rules: RulesConfig): Combination {
  const detected = detectCombination(cards, rules);
  if (!isCombination(detected)) {
    throw new Error(`Bot generated an illegal set: ${detected.reason}`);
  }
  return detected;
}

function isOverride(combination: Combination): boolean {
  return combination.type === 'bomb' || combination.type === 'flush';
}

function idKey(cards: Card[]): string {
  return [...cards.map((card) => card.id)].sort().join(',');
}

function compareCheap(a: Card[], b: Card[], rules: RulesConfig, preferNonOverride: boolean): number {
  const comboA = combinationOf(a, rules);
  const comboB = combinationOf(b, rules);
  if (preferNonOverride) {
    const overrideA = isOverride(comboA);
    const overrideB = isOverride(comboB);
    if (overrideA !== overrideB) {
      return overrideA ? 1 : -1;
    }
  }
  if (comboA.strength !== comboB.strength) {
    return comboA.strength - comboB.strength;
  }
  if (comboA.length !== comboB.length) {
    return comboA.length - comboB.length;
  }
  return idKey(a).localeCompare(idKey(b));
}

function pickCheapest(moves: Card[][], rules: RulesConfig, preferNonOverride: boolean): Card[] {
  const sorted = [...moves].sort((a, b) => compareCheap(a, b, rules, preferNonOverride));
  const first = sorted[0];
  if (!first) {
    throw new Error('No moves to pick');
  }
  return first;
}

function mustIncludeThree(view: BotView): boolean {
  return (
    view.rules.firstLeadMustContainThreeOfSpades &&
    view.handIndex === 0 &&
    !view.history.some((event) => event.kind === 'play')
  );
}

/**
 * Deterministic legal-only heuristic.
 * Lead: cheapest non-bomb/non-flush combo if any exist.
 * Respond: lowest-strength matching-type beat; bomb/flush only if nothing else beats; otherwise pass.
 */
export function chooseBotAction(view: BotView, rules: RulesConfig = view.rules): BotAction {
  const moves = getLegalMoves(view.hand, view.trick, rules, {
    mustIncludeCardId: mustIncludeThree(view) ? THREE_OF_SPADES_ID : undefined,
  });

  if (moves.length === 0) {
    return { type: 'pass' };
  }

  const leading = view.trick.combination === null;
  if (leading) {
    const ordinary = moves.filter((move) => !isOverride(combinationOf(move, rules)));
    const pool = ordinary.length > 0 ? ordinary : moves;
    return { type: 'play', cards: pickCheapest(pool, rules, true) };
  }

  const matching = moves.filter((move) => {
    const combo = combinationOf(move, rules);
    return !isOverride(combo) || combo.type === view.trick.combination?.type;
  });
  if (matching.length > 0) {
    return { type: 'play', cards: pickCheapest(matching, rules, false) };
  }

  const overrides = moves.filter((move) => isOverride(combinationOf(move, rules)));
  if (overrides.length > 0) {
    return { type: 'play', cards: pickCheapest(overrides, rules, false) };
  }

  return { type: 'pass' };
}
