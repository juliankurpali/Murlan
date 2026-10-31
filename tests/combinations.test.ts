import { DEFAULT_RULES, detectCombination, getLegalMoves, isCombination } from '../src/domain';
import { C } from './helpers';

describe('combination detection', () => {
  it('detects singles, pairs, triples, bombs, straights, and flushes', () => {
    expect(detectCombination(C('S5'), DEFAULT_RULES)).toMatchObject({ type: 'single' });
    expect(detectCombination(C('S7', 'H7'), DEFAULT_RULES)).toMatchObject({ type: 'pair' });
    expect(detectCombination(C('S9', 'H9', 'D9'), DEFAULT_RULES)).toMatchObject({ type: 'triple' });
    expect(detectCombination(C('S4', 'H4', 'D4', 'C4'), DEFAULT_RULES)).toMatchObject({
      type: 'bomb',
    });
    expect(detectCombination(C('S3', 'H4', 'D5', 'C6', 'S7'), DEFAULT_RULES)).toMatchObject({
      type: 'straight',
      length: 5,
      strength: 7,
    });
    expect(detectCombination(C('H3', 'H4', 'H5', 'H6', 'H7'), DEFAULT_RULES)).toMatchObject({
      type: 'flush',
      length: 5,
      strength: 7,
    });
  });

  it('rejects invalid duplicates, short sequences, and mismatched ranks', () => {
    const three = C('S3')[0]!;
    expect(isCombination(detectCombination([three, three], DEFAULT_RULES))).toBe(false);
    expect(isCombination(detectCombination(C('S3', 'H5'), DEFAULT_RULES))).toBe(false);
    expect(isCombination(detectCombination(C('S3', 'H4', 'D5', 'C6'), DEFAULT_RULES))).toBe(false);
    expect(isCombination(detectCombination(C('S3', 'H3', 'D3', 'C4'), DEFAULT_RULES))).toBe(false);
  });

  it('restricts jokers to singles', () => {
    expect(detectCombination(C('JB'), DEFAULT_RULES)).toMatchObject({ type: 'single', strength: 16 });
    expect(detectCombination(C('JR'), DEFAULT_RULES)).toMatchObject({ type: 'single', strength: 17 });
    expect(isCombination(detectCombination(C('JB', 'S3'), DEFAULT_RULES))).toBe(false);
    expect(isCombination(detectCombination(C('JB', 'S3', 'H4', 'D5', 'C6'), DEFAULT_RULES))).toBe(
      false,
    );
  });

  it('accepts ace-low A-2-3-4-5 and ace-high 10-J-Q-K-A', () => {
    const aceLow = detectCombination(C('SA', 'S2', 'H3', 'D4', 'C5'), DEFAULT_RULES);
    expect(aceLow).toMatchObject({ type: 'straight', sequence: 'aceLow', strength: 5 });
    const aceHigh = detectCombination(C('S10', 'HJ', 'DQ', 'CK', 'SA'), DEFAULT_RULES);
    expect(aceHigh).toMatchObject({ type: 'straight', sequence: 'high', strength: 14 });
  });

  it('rejects wrapped sequences such as Q-K-A-2-3', () => {
    expect(
      isCombination(detectCombination(C('SQ', 'HK', 'DA', 'C2', 'S3'), DEFAULT_RULES)),
    ).toBe(false);
  });

  it('allows 2-3-4-5-6-7 and 2 through Ace, ace-low A-2-3-4-5-6-7, but not Ace wrapping both ends', () => {
    expect(
      detectCombination(C('S2', 'H3', 'D4', 'C5', 'S6', 'H7'), DEFAULT_RULES),
    ).toMatchObject({ type: 'straight', sequence: 'high', length: 6, strength: 7 });
    expect(
      detectCombination(C('SA', 'S2', 'H3', 'D4', 'C5', 'S6', 'H7'), DEFAULT_RULES),
    ).toMatchObject({ type: 'straight', sequence: 'aceLow', length: 7, strength: 7 });
    expect(
      isCombination(
        detectCombination(
          C('SA', 'S2', 'H3', 'D4', 'C5', 'S6', 'H7', 'D8', 'C9', 'S10', 'HJ', 'DQ', 'CK', 'HA'),
          DEFAULT_RULES,
        ),
      ),
    ).toBe(false);
    expect(
      detectCombination(
        C('S2', 'H3', 'D4', 'C5', 'S6', 'H7', 'D8', 'C9', 'S10', 'HJ', 'DQ', 'CK', 'SA'),
        DEFAULT_RULES,
      ),
    ).toMatchObject({ type: 'straight', sequence: 'high', length: 13, strength: 14 });
    const hand = C('S2', 'H3', 'D4', 'C5', 'S6', 'H7', 'SA');
    const legal = getLegalMoves(
      hand,
      { leaderSeat: 0, combination: null, lastSuccessfulSeat: null, passedSinceLastPlay: [] },
      DEFAULT_RULES,
    );
    const keys = legal.map((move) => [...move.map((card) => card.id)].sort().join(','));
    expect(keys).toContain(['S2', 'H3', 'D4', 'C5', 'S6', 'H7'].sort().join(','));
    expect(keys).toContain(['SA', 'S2', 'H3', 'D4', 'C5', 'S6', 'H7'].sort().join(','));
  });

  it('gates ace-low and ace-high by config', () => {
    const noLow = { ...DEFAULT_RULES, aceLowStraightEnabled: false };
    const noHigh = { ...DEFAULT_RULES, aceHighStraightEnabled: false };
    expect(isCombination(detectCombination(C('SA', 'S2', 'H3', 'D4', 'C5'), noLow))).toBe(false);
    expect(isCombination(detectCombination(C('S10', 'HJ', 'DQ', 'CK', 'SA'), noHigh))).toBe(false);
    expect(isCombination(detectCombination(C('S3', 'H4', 'D5', 'C6', 'S7'), noHigh))).toBe(true);
  });

  it('does not detect flushes when flushEnabled is false; same-suit cards remain a straight', () => {
    const noFlush = { ...DEFAULT_RULES, flushEnabled: false };
    expect(detectCombination(C('H3', 'H4', 'H5', 'H6', 'H7'), noFlush)).toMatchObject({
      type: 'straight',
    });
  });
});
