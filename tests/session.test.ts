import { initialSession, sessionReducer } from '../src/application/session';
import { C, createPlayingState } from './helpers';

describe('session card selection', () => {
  it('keeps a multi-card selection when the table refreshes on the same turn', () => {
    const match = createPlayingState({ hands: [C('S3', 'H3', 'D4'), C('S5'), C('S6'), C('S7')] });
    let state = sessionReducer(initialSession({ screen: 'table', match }), { type: 'toggleCard', cardId: 'S3' });
    state = sessionReducer(state, { type: 'toggleCard', cardId: 'H3' });
    expect(state.selectedIds).toEqual(['S3', 'H3']);

    const refreshed = sessionReducer(state, { type: 'setMatch', match: { ...match } });
    expect(refreshed.selectedIds).toEqual(['S3', 'H3']);
  });

  it('clears selection after a play changes the turn', () => {
    const match = createPlayingState({ hands: [C('S3', 'H3'), C('S5'), C('S6'), C('S7')] });
    let state = sessionReducer(initialSession({ screen: 'table', match }), { type: 'toggleCard', cardId: 'S3' });
    const afterPlay = createPlayingState({
      hands: [C('H3'), C('S5'), C('S6'), C('S7')],
      currentSeat: 1,
      history: [{ kind: 'pass', seat: 0 }],
    });
    state = sessionReducer(state, { type: 'setMatch', match: afterPlay });
    expect(state.selectedIds).toEqual([]);
  });
});
