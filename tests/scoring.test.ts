import {
  applyPlay,
  DEFAULT_RULES,
  isRuleError,
  placeForSeat,
  scoreHand,
  startNextHand,
  createSeededRandom,
} from '../src/domain';
import { C, createPlayingState } from './helpers';

describe('scoring', () => {
  it('awards 3/2/1/0 in individual mode', () => {
    let state = createPlayingState({
      mode: 'individual',
      hands: [C('S3'), C('S4'), C('S5'), C('S6')],
    });
    for (const [seat, cards] of [
      [0, C('S3')],
      [1, C('S4')],
      [2, C('S5')],
    ] as const) {
      const next = applyPlay(state, seat, cards);
      if (isRuleError(next)) {
        throw new Error(next.message);
      }
      state = next;
    }
    expect(state.scores).toEqual([3, 2, 1, 0]);
    expect(state.phase).toBe('handComplete');
    expect(placeForSeat(0, state.finishOrder)).toBe(1);
    expect(placeForSeat(1, state.finishOrder)).toBe(2);
    expect(placeForSeat(2, state.finishOrder)).toBe(3);
    expect(placeForSeat(3, state.finishOrder)).toBe(4);
    const next = startNextHand(state, DEFAULT_RULES, createSeededRandom(4));
    if (isRuleError(next)) {
      throw new Error(next.message);
    }
    expect(next.scores).toEqual([3, 2, 1, 0]);
  });

  it('sums partners in 2v2 with no teammate-first bonus', () => {
    const state = createPlayingState({
      mode: '2v2',
      hands: [C('S3'), C('S4'), C('S5'), C('S6')],
      finishOrder: [0, 1, 2],
      phase: 'playing',
    });
    const scored = scoreHand(state, DEFAULT_RULES);
    expect(scored.pointsThisHand).toEqual([3, 2, 1, 0]);
    expect(scored.scores[0] + scored.scores[2]).toBe(4);
    expect(scored.scores[1] + scored.scores[3]).toBe(2);
  });

  it('bumps the target by 10 when two individuals reach it in the same hand', () => {
    let state = createPlayingState({
      mode: 'individual',
      scores: [19, 19, 0, 0],
      targetScore: 21,
      hands: [C('S3'), C('S4'), C('S5'), C('S6')],
    });
    for (const [seat, cards] of [
      [0, C('S3')],
      [1, C('S4')],
      [2, C('S5')],
    ] as const) {
      const next = applyPlay(state, seat, cards);
      if (isRuleError(next)) {
        throw new Error(next.message);
      }
      state = next;
    }
    expect(state.scores).toEqual([22, 21, 1, 0]);
    expect(state.targetScore).toBe(31);
    expect(state.phase).toBe('handComplete');
    expect(state.winner).toBeNull();
  });

  it('completes the match when a single team reaches the target', () => {
    let state = createPlayingState({
      mode: '2v2',
      scores: [10, 0, 10, 0],
      targetScore: 21,
      hands: [C('S3'), C('S4'), C('S5'), C('S6')],
    });
    const first = applyPlay(state, 0, C('S3'));
    if (isRuleError(first)) {
      throw new Error(first.message);
    }
    state = first;
    const second = applyPlay(state, 1, C('S4'));
    if (isRuleError(second)) {
      throw new Error(second.message);
    }
    state = second;
    const third = applyPlay(state, 2, C('S5'));
    if (isRuleError(third)) {
      throw new Error(third.message);
    }
    state = third;
    expect(state.phase).toBe('matchComplete');
    expect(state.winner).toBe('team0');
  });

  it('lets last place open the next hand after the exchange', () => {
    const state = createPlayingState({
      mode: 'individual',
      phase: 'handComplete',
      finishOrder: [2, 0, 1],
      hands: [C('S3'), C('S4'), C('S5'), C('S6')],
    });
    const next = startNextHand(state, DEFAULT_RULES, createSeededRandom(3));
    if (isRuleError(next)) {
      throw new Error(next.message);
    }
    expect(next.handIndex).toBe(1);
    expect(next.scores).toEqual(state.scores);
    expect(next.dealerSeat).toBe(1);
    expect(next.phase).toBe('playing');
    expect(next.finishOrder).toEqual([]);
    if (next.lastExchange?.kind === 'skipped') {
      expect(next.currentSeat).toBe(2);
    } else {
      expect(next.currentSeat).toBe(3);
    }
  });
});
