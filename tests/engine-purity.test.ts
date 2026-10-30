import * as domain from '../src/domain';
import { C, createPlayingState } from './helpers';

describe('engine isolation', () => {
  it('exports engine APIs from the domain package', () => {
    expect(typeof domain.createGame).toBe('function');
    expect(typeof domain.applyPlay).toBe('function');
    expect(typeof domain.applyPass).toBe('function');
    expect(typeof domain.getLegalMoves).toBe('function');
    expect(typeof domain.detectCombination).toBe('function');
    expect(typeof domain.canBeat).toBe('function');
  });

  it('sanitizes opponent hands from the public view', () => {
    const state = createPlayingState({
      hands: [C('S3', 'S4'), C('HA', 'H2', 'JR'), C('D9'), C('C10')],
    });
    const view = domain.toPublicView(state, 0);
    expect(view.ownHand.map((card) => card.id)).toEqual(['S3', 'S4']);
    expect(view.cardCounts).toEqual([2, 3, 1, 1]);
    expect(JSON.stringify(view)).not.toContain('JR');
    expect(JSON.stringify(view)).not.toContain('H2');
  });

  it('rebuilds opponent card counts so the table can show their backs', () => {
    const state = createPlayingState({
      hands: [C('S3', 'S4'), C('HA', 'H2', 'JR'), C('D9'), C('C10')],
    });
    const view = domain.toPublicView(state, 0);
    const rebuilt = require('../src/platform/viewMatch').matchFromView(view);
    const next = domain.toPublicView(rebuilt, 0);
    expect(next.cardCounts).toEqual([2, 3, 1, 1]);
    expect(next.ownHand.map((card: { id: string }) => card.id)).toEqual(['S3', 'S4']);
    expect(JSON.stringify(next)).not.toContain('JR');
  });
});
