import {
  applyAutoTurn,
  applyBotTurn,
  HUMAN_SEAT,
  isBotTurn,
  matchIsUnfinished,
  nextHand,
  startMatch,
  submitPass,
  submitPlay,
} from '../src/application';
import { createSeededRandom, isRuleError, toPublicView } from '../src/domain';
import { C, createPlayingState } from './helpers';

describe('application use cases', () => {
  it('starts a 2v2 match and keeps opponent hands out of the public view', () => {
    const match = startMatch(createSeededRandom(5));
    expect(match.mode).toBe('2v2');
    expect(match.phase).toBe('playing');
    const view = toPublicView(match, HUMAN_SEAT);
    expect(view.ownHand).toHaveLength(match.hands[0].length);
    expect(JSON.stringify(view)).not.toContain(match.hands[1][0]?.id);
  });

  it('rejects an empty pass on lead and accepts a legal human play', () => {
    const match = startMatch(createSeededRandom(12));
    const pass = submitPass(match);
    expect(isRuleError(pass)).toBe(true);
    const three = match.hands[match.currentSeat].find((card) => card.id === 'S3');
    if (match.currentSeat === HUMAN_SEAT && three) {
      const played = submitPlay(match, [three]);
      expect(isRuleError(played)).toBe(false);
    }
  });

  it('advances a bot only on a bot seat', () => {
    let match = startMatch(createSeededRandom(21));
    if (match.currentSeat === HUMAN_SEAT) {
      const three = match.hands[0].find((card) => card.id === 'S3');
      if (three) {
        const played = submitPlay(match, [three]);
        if (!isRuleError(played)) {
          match = played;
        }
      }
    }
    if (isBotTurn(match)) {
      const next = applyBotTurn(match);
      expect(isRuleError(next)).toBe(false);
    }
    expect(matchIsUnfinished(match)).toBe(true);
  });

  it('auto-plays a legal move when a seat’s timer expires', () => {
    const state = startMatch(createSeededRandom(21));
    const next = applyAutoTurn(state, state.currentSeat);
    expect(isRuleError(next)).toBe(false);
    if (!isRuleError(next)) {
      expect(next.history.some((event) => event.kind === 'play' || event.kind === 'pass')).toBe(true);
      expect(next.currentSeat).not.toBe(state.currentSeat);
    }
  });

  it('refuses nextHand while a hand is still being played', () => {
    const match = startMatch(createSeededRandom(8));
    const result = nextHand(match, createSeededRandom(9));
    expect(isRuleError(result)).toBe(true);
  });

  it('waits for the human to choose a return card when they finished first', () => {
    const match = createPlayingState({
      phase: 'handComplete',
      finishOrder: [0, 1, 2],
      hands: [C('S3'), C('S4'), C('S5'), C('S6')],
    });
    const result = nextHand(match, createSeededRandom(3));
    expect(isRuleError(result)).toBe(false);
    if (isRuleError(result)) {
      return;
    }
    if (result.lastExchange?.kind === 'skipped') {
      expect(result.phase).toBe('playing');
      expect(result.currentSeat).toBe(HUMAN_SEAT);
      return;
    }
    expect(result.phase).toBe('exchanging');
    expect(result.pendingExchange?.firstSeat).toBe(HUMAN_SEAT);
    expect(result.currentSeat).toBe(HUMAN_SEAT);
  });
});
