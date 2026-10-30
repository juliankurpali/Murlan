import { startMatch } from '../src/application';
import { createSeededRandom } from '../src/domain';
import { PersistedMatch } from '../src/application/types';

describe('match persistence payload', () => {
  it('round-trips GameState JSON with schemaVersion and rules', () => {
    const state = startMatch('2v2', createSeededRandom(44));
    const payload: PersistedMatch = {
      schemaVersion: 1,
      state,
      savedAt: '2026-10-30T00:00:00.000Z',
    };
    const restored = JSON.parse(JSON.stringify(payload)) as PersistedMatch;
    expect(restored.schemaVersion).toBe(1);
    expect(restored.state.rules.flushEnabled).toBe(true);
    expect(restored.state.hands).toHaveLength(4);
    expect(restored.state.hands.flat().map((card) => card.id).sort()).toEqual(
      state.hands.flat().map((card) => card.id).sort(),
    );
  });
});
