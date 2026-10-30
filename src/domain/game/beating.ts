import { RulesConfig } from '../rules/types';
import { Combination } from './types';

function isOrdinary(type: Combination['type']): boolean {
  return type === 'single' || type === 'pair' || type === 'triple' || type === 'straight';
}

function sameShape(candidate: Combination, current: Combination): boolean {
  return candidate.type === current.type && candidate.length === current.length;
}

function strongerSameShape(candidate: Combination, current: Combination): boolean {
  return sameShape(candidate, current) && candidate.strength > current.strength;
}

/**
 * Flush vs ordinary/bomb defaults:
 * - flushEnabled && flushBeatsBomb: flush beats ordinary and bombs; only a higher
 *   flush beats a flush; bombs cannot beat a flush.
 * - flushEnabled && !flushBeatsBomb: flush is same-type only; bombs beat ordinary only.
 */
export function canBeat(
  candidate: Combination,
  current: Combination,
  rules: RulesConfig,
): boolean {
  if (candidate.type === 'flush') {
    if (!rules.flushEnabled) {
      return false;
    }
    if (current.type === 'flush') {
      return strongerSameShape(candidate, current);
    }
    if (rules.flushBeatsBomb) {
      return true;
    }
    return false;
  }

  if (candidate.type === 'bomb') {
    if (current.type === 'bomb') {
      return candidate.strength > current.strength;
    }
    if (current.type === 'flush') {
      return false;
    }
    return isOrdinary(current.type);
  }

  if (current.type === 'bomb' || current.type === 'flush') {
    return false;
  }

  return strongerSameShape(candidate, current);
}

export function describeCannotBeat(
  candidate: Combination,
  current: Combination,
  rules: RulesConfig,
): string {
  if (canBeat(candidate, current, rules)) {
    return '';
  }
  if (current.type === 'flush' && candidate.type !== 'flush') {
    return 'Only a higher flush can beat a flush.';
  }
  if (candidate.type === 'flush' && !rules.flushBeatsBomb && current.type !== 'flush') {
    return 'This flush can only be played on another flush.';
  }
  if (candidate.type !== current.type && candidate.type !== 'bomb' && candidate.type !== 'flush') {
    return `Need a ${current.type} of ${current.length}, a bomb, or a flush.`;
  }
  if (candidate.type === current.type && candidate.length !== current.length) {
    return `Need the same length (${current.length} cards).`;
  }
  if (candidate.type === current.type && candidate.strength <= current.strength) {
    return 'That combination is not high enough.';
  }
  return 'That play does not beat the current combination.';
}
