import {
  applyPass,
  applyPlay,
  DEFAULT_RULES,
  isRuleError,
  legalMovesForSeat,
} from '../src/domain';
import { C, createPlayingState } from './helpers';

describe('turn, pass, and trick flow', () => {
  it('forbids passing on an empty lead', () => {
    const state = createPlayingState({
      hands: [C('S5'), C('S6'), C('S7'), C('S8')],
    });
    const result = applyPass(state, 0);
    expect(isRuleError(result)).toBe(true);
    if (isRuleError(result)) {
      expect(result.code).toBe('cannotPassOnLead');
    }
  });

  it('closes a trick after the other active seats pass and returns the lead', () => {
    let state = createPlayingState({
      hands: [C('S5', 'S9'), C('S6'), C('S7'), C('S8')],
    });
    const play = applyPlay(state, 0, C('S5'));
    if (isRuleError(play)) {
      throw new Error(play.message);
    }
    state = play;
    expect(state.currentSeat).toBe(1);

    for (const seat of [1, 2, 3] as const) {
      const passed = applyPass(state, seat);
      if (isRuleError(passed)) {
        throw new Error(passed.message);
      }
      state = passed;
    }

    expect(state.trick.combination).toBeNull();
    expect(state.currentSeat).toBe(0);
    expect(state.trick.leaderSeat).toBe(0);
  });

  it('allows re-entry after a pass before the trick closes', () => {
    let state = createPlayingState({
      hands: [C('S5', 'S4'), C('S6', 'S10'), C('S7'), C('S8')],
    });
    const lead = applyPlay(state, 0, C('S5'));
    if (isRuleError(lead)) {
      throw new Error(lead.message);
    }
    state = lead;
    const firstPass = applyPass(state, 1);
    if (isRuleError(firstPass)) {
      throw new Error(firstPass.message);
    }
    state = firstPass;
    const beat = applyPlay(state, 2, C('S7'));
    if (isRuleError(beat)) {
      throw new Error(beat.message);
    }
    state = beat;
    const seat3Pass = applyPass(state, 3);
    if (isRuleError(seat3Pass)) {
      throw new Error(seat3Pass.message);
    }
    state = seat3Pass;
    const seat0Pass = applyPass(state, 0);
    if (isRuleError(seat0Pass)) {
      throw new Error(seat0Pass.message);
    }
    state = seat0Pass;
    expect(state.currentSeat).toBe(1);
    const reentry = applyPlay(state, 1, C('S10'));
    expect(isRuleError(reentry)).toBe(false);
  });

  it('skips finished players on later turns', () => {
    let state = createPlayingState({
      hands: [C('S3'), C('S4', 'S9'), C('S5', 'S10'), C('S6', 'SJ')],
    });
    const out = applyPlay(state, 0, C('S3'));
    if (isRuleError(out)) {
      throw new Error(out.message);
    }
    state = out;
    expect(state.finishOrder).toEqual([0]);
    expect(state.currentSeat).toBe(1);

    const beat = applyPlay(state, 1, C('S4'));
    if (isRuleError(beat)) {
      throw new Error(beat.message);
    }
    state = beat;
    const pass2 = applyPass(state, 2);
    if (isRuleError(pass2)) {
      throw new Error(pass2.message);
    }
    state = pass2;
    const pass3 = applyPass(state, 3);
    if (isRuleError(pass3)) {
      throw new Error(pass3.message);
    }
    state = pass3;
    expect(state.currentSeat).toBe(1);
    expect(state.trick.combination).toBeNull();
  });

  it('ends the hand when one player remains', () => {
    let state = createPlayingState({
      hands: [C('S3'), C('S4'), C('S5'), C('S6', 'S7')],
    });
    for (const [seat, ids] of [
      [0, C('S3')],
      [1, C('S4')],
      [2, C('S5')],
    ] as const) {
      const next = applyPlay(state, seat, ids);
      if (isRuleError(next)) {
        throw new Error(next.message);
      }
      state = next;
    }
    expect(state.phase).toBe('handComplete');
    expect(state.finishOrder).toEqual([0, 1, 2, 3]);
    expect(state.lastHandPoints).toEqual([3, 2, 1, 0]);
  });

  it('requires 3♠ in the first lead of the first hand', () => {
    const state = createPlayingState({
      rules: DEFAULT_RULES,
      hands: [C('S3', 'S9'), C('S4'), C('S5'), C('S6')],
      currentSeat: 0,
    });
    const illegal = applyPlay(state, 0, C('S9'));
    expect(isRuleError(illegal)).toBe(true);
    if (isRuleError(illegal)) {
      expect(illegal.code).toBe('mustIncludeThreeOfSpades');
    }
    const legal = applyPlay(state, 0, C('S3'));
    expect(isRuleError(legal)).toBe(false);
  });

  it('generates legal moves by combination type', () => {
    const state = createPlayingState({
      handIndex: 1,
      hands: [C('S3', 'H3', 'D3', 'C3', 'S4', 'H5', 'D6', 'C7', 'S8', 'JB'), C('S9'), C('S10'), C('SJ')],
    });
    const moves = legalMovesForSeat(state, 0);
    const keys = new Set(moves.map((move) => move.map((card) => card.id).sort().join(',')));
    expect(keys.has('S3')).toBe(true);
    expect(keys.has('C3,D3,H3,S3')).toBe(true);
    expect(keys.has('C7,D6,H5,S4,S8')).toBe(true);
    expect(moves.every((move) => move.length >= 1)).toBe(true);
  });
});
