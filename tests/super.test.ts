import {
  createGame,
  createSeededRandom,
  createSuperDeck,
  DEFAULT_RULES,
  detectCombination,
  isRuleError,
  playerCountFor,
  scoreHand,
  SUPER_MURLAN,
  SUPER_RULES,
  teamScores,
  validateSuperDeck,
} from '../src/domain';
import { applyPlay } from '../src/domain/game/engine';
import { C, createPlayingState } from './helpers';
import { payloadFor, startMatch } from '../src/platform/match';
import { tableSeat } from '../src/online/room';
import { PlatformStore } from '../src/platform/store';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function tempStore(): PlatformStore {
  return new PlatformStore(join(mkdtempSync(join(tmpdir(), 'murlan-')), 'platform.json'));
}

describe('Super Murlan', () => {
  it('builds an 82-card deck with six of each rank and four jokers', () => {
    const deck = createSuperDeck(createSeededRandom(21));
    expect(deck).toHaveLength(SUPER_MURLAN.totalCards);
    validateSuperDeck(deck);
    expect(new Set(deck.map((card) => card.id)).size).toBe(82);
    const byRank = new Map<number, number>();
    let black = 0;
    let red = 0;
    for (const card of deck) {
      if (card.kind === 'joker') {
        if (card.color === 'black') {
          black += 1;
        } else {
          red += 1;
        }
        continue;
      }
      byRank.set(card.rank, (byRank.get(card.rank) ?? 0) + 1);
    }
    expect(black).toBe(2);
    expect(red).toBe(2);
    expect([...byRank.values()].every((count) => count === 6)).toBe(true);
  });

  it('deals 13 cards to six seats and keeps four undealt', () => {
    const game = createGame({ mode: 'super', random: createSeededRandom(8) });
    expect(game.mode).toBe('super');
    expect(playerCountFor(game.mode)).toBe(6);
    expect(game.hands).toHaveLength(6);
    expect(game.hands.every((hand) => hand.length === 13)).toBe(true);
    expect(game.undealt).toHaveLength(4);
    expect(game.hands.flat().length + game.undealt.length).toBe(82);
    expect(game.teamOf).toEqual([0, 1, 2, 0, 1, 2]);
    expect(game.targetScore).toBe(150);
    expect(game.rules.pointsByFinishOrder).toEqual([15, 12, 9, 6, 3, 1]);
  });

  it('does not change classic dealing', () => {
    const classic = createGame({ mode: '2v2', random: createSeededRandom(8) });
    expect(classic.hands).toHaveLength(4);
    expect(classic.undealt).toHaveLength(0);
    expect(classic.hands.flat()).toHaveLength(54);
    expect(classic.targetScore).toBe(21);
  });

  it('awards 15/12/9/6/3/1 and sums teammates', () => {
    const state = createPlayingState({
      mode: 'super',
      rules: { ...DEFAULT_RULES, ...SUPER_RULES, firstLeadMustContainThreeOfSpades: false },
      targetScore: 150,
      hands: [C('S3'), C('S4'), C('S5'), C('S6'), C('S7'), C('S8')],
      finishOrder: [0, 1, 2, 3, 4],
      teamOf: [0, 1, 2, 0, 1, 2],
    });
    const scored = scoreHand(state, state.rules);
    expect(scored.pointsThisHand).toEqual([15, 12, 9, 6, 3, 1]);
    expect(teamScores(scored.scores, state.teamOf)).toEqual({ team0: 21, team1: 15, team2: 10 });
    expect(scored.phase).toBe('handComplete');
  });

  it('needs 150 and a 10-point lead to win', () => {
    const close = createPlayingState({
      mode: 'super',
      rules: { ...DEFAULT_RULES, ...SUPER_RULES, firstLeadMustContainThreeOfSpades: false },
      scores: [70, 70, 0, 70, 70, 0],
      targetScore: 150,
      hands: [C('S3'), C('S4'), C('S5'), C('S6'), C('S7'), C('S8')],
      finishOrder: [0, 1, 2, 3, 4],
      teamOf: [0, 1, 2, 0, 1, 2],
    });
    const almost = scoreHand(close, close.rules);
    expect(almost.phase).toBe('handComplete');
    expect(almost.winner).toBeNull();
    const almostTeams = teamScores(almost.scores, close.teamOf);
    expect(almostTeams.team0).toBeGreaterThanOrEqual(150);
    expect(almostTeams.team0 - almostTeams.team1).toBeLessThan(10);

    const win = createPlayingState({
      mode: 'super',
      rules: { ...DEFAULT_RULES, ...SUPER_RULES, firstLeadMustContainThreeOfSpades: false },
      scores: [80, 40, 0, 80, 40, 0],
      targetScore: 150,
      hands: [C('S3'), C('S4'), C('S5'), C('S6'), C('S7'), C('S8')],
      finishOrder: [0, 3, 1, 4, 2],
      teamOf: [0, 1, 2, 0, 1, 2],
    });
    const done = scoreHand(win, win.rules);
    expect(done.phase).toBe('matchComplete');
    expect(done.winner).toBe('team0');
  });

  it('lets six humans sit and start a super match from the platform', () => {
    const store = tempStore();
    const host = store.auth(store.guest('superhost1').token)!;
    const game = store.createGame(host);
    store.setMatchMode(host, game, 'super');
    expect(game.seats).toHaveLength(6);
    for (const secret of ['superaaaa', 'superbbbb', 'supercccc', 'superdddd', 'supereeee']) {
      const guest = store.auth(store.guest(secret).token)!;
      store.joinGame(guest, game.code);
    }
    startMatch(game);
    expect(game.match?.mode).toBe('super');
    expect(game.match?.hands.every((hand) => hand.length === 13)).toBe(true);
    expect(game.match?.undealt).toHaveLength(4);
    const hostView = payloadFor(game, host.id)!;
    expect(hostView.view.mode).not.toBe('lies');
    if (hostView.view.mode === 'lies') {
      throw new Error('expected super view');
    }
    expect(hostView.view.ownHand).toHaveLength(13);
    expect(hostView.view.cardCounts).toEqual([13, 13, 13, 13, 13, 13]);
    expect(hostView.view.undealtCount).toBe(4);
    expect(hostView.view.teamOf).toEqual([0, 1, 2, 0, 1, 2]);
    const otherHands = game.match!.hands.flatMap((hand, seat) => (seat === hostView.seat ? [] : hand.map((card) => card.id)));
    expect(hostView.view.ownHand.every((card) => !otherHands.includes(card.id))).toBe(true);
    expect(JSON.stringify(hostView.view)).not.toContain(game.match!.undealt[0]!.id);
  });

  it('keeps playing when two teams are tied at 150', () => {
    const state = createPlayingState({
      mode: 'super',
      rules: { ...DEFAULT_RULES, ...SUPER_RULES, firstLeadMustContainThreeOfSpades: false },
      scores: [70, 70, 0, 70, 70, 0],
      targetScore: 150,
      hands: [C('S3'), C('S4'), C('S5'), C('S6'), C('S7'), C('S8')],
      finishOrder: [0, 1, 2, 4, 3],
      teamOf: [0, 1, 2, 0, 1, 2],
    });
    const scored = scoreHand(state, state.rules);
    expect(scored.pointsThisHand).toEqual([15, 12, 9, 3, 6, 1]);
    expect(teamScores(scored.scores, state.teamOf)).toEqual({ team0: 158, team1: 158, team2: 10 });
    expect(scored.phase).toBe('handComplete');
    expect(scored.winner).toBeNull();
  });

  it('seats teammates opposite and still treats matching ranks as legal pairs', () => {
    expect(tableSeat(0, 'north', 6)).toBe(3);
    expect(tableSeat(1, 'north', 6)).toBe(4);
    expect(tableSeat(2, 'north', 6)).toBe(5);
    const copies = [
      { id: 'S3#0', kind: 'standard' as const, suit: 'spades' as const, rank: 3 as const },
      { id: 'S3#4', kind: 'standard' as const, suit: 'spades' as const, rank: 3 as const },
    ];
    const combo = detectCombination(copies, DEFAULT_RULES);
    expect(combo.type).toBe('pair');
  });

  it('rotates six-player turns until five have finished', () => {
    let state = createPlayingState({
      mode: 'super',
      rules: { ...DEFAULT_RULES, ...SUPER_RULES, firstLeadMustContainThreeOfSpades: false },
      targetScore: 150,
      hands: [C('S3'), C('S4'), C('S5'), C('S6'), C('S7'), C('S8')],
    });
    for (const [seat, cards] of [
      [0, C('S3')],
      [1, C('S4')],
      [2, C('S5')],
      [3, C('S6')],
      [4, C('S7')],
    ] as const) {
      const next = applyPlay(state, seat, cards);
      if (isRuleError(next)) {
        throw new Error(next.message);
      }
      state = next;
    }
    expect(state.phase).toBe('handComplete');
    expect(state.finishOrder).toEqual([0, 1, 2, 3, 4, 5]);
    expect(state.lastHandPoints).toEqual([15, 12, 9, 6, 3, 1]);
  });
});
