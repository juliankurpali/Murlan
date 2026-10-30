import {
  applyPass,
  applyPlay,
  chooseBotAction,
  createGame,
  createSeededRandom,
  DEFAULT_RULES,
  detectCombination,
  getLegalMoves,
  isCombination,
  isRuleError,
  toBotView,
} from '../src/domain';
import { C, createPlayingState } from './helpers';

describe('bot heuristic', () => {
  it('chooses only legal moves', () => {
    const state = createPlayingState({
      hands: [C('S5', 'H5', 'S9'), C('S6', 'S7'), C('S8'), C('S10')],
      currentSeat: 1,
    });
    const led = applyPlay(state, 1, C('S6'));
    if (isRuleError(led)) {
      throw new Error(led.message);
    }
    const view = toBotView(led, 0);
    const action = chooseBotAction(view, DEFAULT_RULES);
    const legal = getLegalMoves(view.hand, view.trick, DEFAULT_RULES);
    if (action.type === 'play') {
      const key = action.cards
        .map((card) => card.id)
        .sort()
        .join(',');
      expect(
        legal.some((move) => move.map((card) => card.id).sort().join(',') === key),
      ).toBe(true);
    }
  });

  it('leads a cheap ordinary combo instead of a bomb', () => {
    const state = createPlayingState({
      hands: [C('S3', 'H3', 'D3', 'C3', 'S5'), C('S4'), C('S6'), C('S7')],
      currentSeat: 0,
    });
    const action = chooseBotAction(toBotView(state, 0), DEFAULT_RULES);
    expect(action.type).toBe('play');
    if (action.type === 'play') {
      const combo = detectCombination(action.cards, DEFAULT_RULES);
      expect(isCombination(combo) && combo.type !== 'bomb').toBe(true);
    }
  });

  it('is deterministic for the same view', () => {
    const state = createPlayingState({
      hands: [C('S8', 'H8', 'S4', 'H5', 'D6', 'C7', 'S9'), C('S3'), C('S2'), C('SA')],
    });
    const view = toBotView(state, 0);
    const a = chooseBotAction(view, DEFAULT_RULES);
    const b = chooseBotAction(view, DEFAULT_RULES);
    expect(a).toEqual(b);
  });

  it('never produces an illegal action in a full four-bot hand', () => {
    let state = createGame({ mode: 'individual', random: createSeededRandom(99) });
    let guard = 0;
    while (state.phase === 'playing' && guard < 500) {
      guard += 1;
      const view = toBotView(state, state.currentSeat);
      const action = chooseBotAction(view, state.rules);
      const next =
        action.type === 'play'
          ? applyPlay(state, state.currentSeat, action.cards)
          : applyPass(state, state.currentSeat);
      if (isRuleError(next)) {
        throw new Error(next.message);
      }
      state = next;
    }
    expect(state.phase).toBe('handComplete');
    expect(state.finishOrder).toHaveLength(4);
  });
});
