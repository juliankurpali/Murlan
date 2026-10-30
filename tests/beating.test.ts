import { canBeat, DEFAULT_RULES, detectCombination, isCombination } from '../src/domain';
import { Combination } from '../src/domain/game/types';
import { C } from './helpers';

function combo(ids: string[]) {
  const detected = detectCombination(C(...ids), DEFAULT_RULES);
  if (!isCombination(detected)) {
    throw new Error(`expected combination, got ${detected.reason}`);
  }
  return detected;
}

describe('beating rules', () => {
  it('requires same type and same size, with higher strength', () => {
    expect(canBeat(combo(['S8']), combo(['S5']), DEFAULT_RULES)).toBe(true);
    expect(canBeat(combo(['S5']), combo(['S8']), DEFAULT_RULES)).toBe(false);
    expect(canBeat(combo(['S8', 'H8']), combo(['S5']), DEFAULT_RULES)).toBe(false);
    expect(canBeat(combo(['S6', 'H7', 'D8', 'C9', 'S10']), combo(['S3', 'H4', 'D5', 'C6', 'S7']), DEFAULT_RULES)).toBe(
      true,
    );
    expect(
      canBeat(
        combo(['S3', 'H4', 'D5', 'C6', 'S7', 'H8']),
        combo(['S3', 'H4', 'D5', 'C6', 'S7']),
        DEFAULT_RULES,
      ),
    ).toBe(false);
  });

  it('lets a bomb beat ordinary combinations and a higher bomb beat a bomb', () => {
    const bomb4 = combo(['S4', 'H4', 'D4', 'C4']);
    const bomb9 = combo(['S9', 'H9', 'D9', 'C9']);
    expect(canBeat(bomb4, combo(['SA']), DEFAULT_RULES)).toBe(true);
    expect(canBeat(bomb4, combo(['S8', 'H8']), DEFAULT_RULES)).toBe(true);
    expect(canBeat(bomb4, combo(['S3', 'H4', 'D5', 'C6', 'S7']), DEFAULT_RULES)).toBe(true);
    expect(canBeat(bomb9, bomb4, DEFAULT_RULES)).toBe(true);
    expect(canBeat(bomb4, bomb9, DEFAULT_RULES)).toBe(false);
    expect(canBeat(combo(['S2']), bomb4, DEFAULT_RULES)).toBe(false);
  });

  it('lets a flush beat a bomb when flushBeatsBomb is true', () => {
    const flush = combo(['H3', 'H4', 'H5', 'H6', 'H7']);
    const bomb = combo(['S4', 'H4', 'D4', 'C4']);
    expect(canBeat(flush, bomb, DEFAULT_RULES)).toBe(true);
    expect(canBeat(bomb, flush, DEFAULT_RULES)).toBe(false);
    expect(canBeat(flush, combo(['S3', 'H4', 'D5', 'C6', 'S7']), DEFAULT_RULES)).toBe(true);
    const higherFlush = combo(['H8', 'H9', 'H10', 'HJ', 'HQ']);
    expect(canBeat(higherFlush, flush, DEFAULT_RULES)).toBe(true);
    expect(canBeat(flush, higherFlush, DEFAULT_RULES)).toBe(false);
  });

  it('keeps flush same-type-only when flushBeatsBomb is false', () => {
    const rules = { ...DEFAULT_RULES, flushBeatsBomb: false };
    const flush = detectCombination(C('H3', 'H4', 'H5', 'H6', 'H7'), rules) as Combination;
    const bomb = detectCombination(C('S4', 'H4', 'D4', 'C4'), rules) as Combination;
    const straight = detectCombination(C('S3', 'H4', 'D5', 'C6', 'S7'), rules) as Combination;
    expect(canBeat(flush, bomb, rules)).toBe(false);
    expect(canBeat(bomb, flush, rules)).toBe(false);
    expect(canBeat(flush, straight, rules)).toBe(false);
    expect(canBeat(bomb, straight, rules)).toBe(true);
    const higherFlush = detectCombination(C('H8', 'H9', 'H10', 'HJ', 'HQ'), rules) as Combination;
    expect(canBeat(higherFlush, flush, rules)).toBe(true);
  });
});
