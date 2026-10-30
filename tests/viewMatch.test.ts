import { toPublicView } from '../src/domain';
import { matchFromView } from '../src/platform/viewMatch';
import { C, createPlayingState } from './helpers';

describe('matchFromView', () => {
  it('keeps opponent card counts so the table can show their backs', () => {
    const state = createPlayingState({
      hands: [C('S3', 'S4'), C('HA', 'H2', 'JR'), C('D9'), C('C10')],
    });
    const view = toPublicView(state, 0);
    const next = toPublicView(matchFromView(view), 0);
    expect(next.cardCounts).toEqual([2, 3, 1, 1]);
    expect(next.ownHand.map((card) => card.id)).toEqual(['S3', 'S4']);
    expect(JSON.stringify(next)).not.toContain('JR');
  });
});
