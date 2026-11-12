import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSeededRandom } from '../src/domain/cards/random';
import { Card, StandardRank } from '../src/domain/cards/types';
import {
  applyLiesBelieve,
  applyLiesChallenge,
  applyLiesClaim,
  applyLiesClear,
  createLiesGame,
  createLiesGameSeeded,
  dealLies,
  isLiesError,
  maxPlayFor,
  toPublicLiesView,
} from '../src/domain/lies';
import { PlatformStore } from '../src/platform/store';
import { autoAct, payloadFor, startMatch, turnDelay } from '../src/platform/match';

function tempStore() {
  return new PlatformStore(join(mkdtempSync(join(tmpdir(), 'murlan-lies-')), 'platform.json'));
}

function std(
  id: string,
  rank: StandardRank,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs' = 'spades',
): Card {
  return { id, kind: 'standard', suit, rank };
}

describe('lies deal', () => {
  it('deals evenly without jokers for 3–6 × 1–2 decks', () => {
    for (const players of [3, 4, 5, 6]) {
      for (const decks of [1, 2] as const) {
        const { hands, undealt } = dealLies(players, decks, createSeededRandom(players * 10 + decks));
        const total = hands.reduce((sum, hand) => sum + hand.length, 0) + undealt.length;
        expect(total).toBe(52 * decks);
        expect(hands.every((hand) => hand.every((card) => card.kind === 'standard'))).toBe(true);
        const sizes = hands.map((hand) => hand.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBe(0);
        expect(undealt.length).toBe((52 * decks) % players);
        expect(maxPlayFor(decks)).toBe(4 * decks);
      }
    }
  });
});

describe('lies engine', () => {
  it('lead claim then add same rank', () => {
    const state = createLiesGameSeeded(3, 1, 1, 0);
    // Force known hands
    state.hands = [
      [std('a', 7), std('b', 7), std('c', 8)],
      [std('d', 9), std('e', 10)],
      [std('f', 11), std('g', 12)],
    ];
    const led = applyLiesClaim(state, 0, ['a'], 7);
    expect(isLiesError(led)).toBe(false);
    if (isLiesError(led)) return;
    expect(led.phase).toBe('responding');
    expect(led.claimedRank).toBe(7);
    expect(led.pile?.cards.length).toBe(1);
    expect(led.currentSeat).toBe(1);

    const believed = applyLiesBelieve(led, 1);
    expect(isLiesError(believed)).toBe(false);
    if (isLiesError(believed)) return;
    expect(believed.currentSeat).toBe(2);

    const added = applyLiesClaim(believed, 2, ['f'], 7);
    expect(isLiesError(added)).toBe(false);
    if (isLiesError(added)) return;
    expect(added.lastClaim?.seat).toBe(2);
    expect(added.claimedRank).toBe(7);
    expect(added.pile?.cards.length).toBe(2);
    expect(added.phase).toBe('responding');
  });

  it('challenge true → challenger gets pile, last leads', () => {
    let state = createLiesGameSeeded(3, 1, 2, 0);
    state.hands = [
      [std('a', 5), std('b', 6)],
      [std('c', 7)],
      [std('d', 8)],
    ];
    const led = applyLiesClaim(state, 0, ['a'], 5);
    expect(isLiesError(led)).toBe(false);
    if (isLiesError(led)) return;
    const challenged = applyLiesChallenge(led, 1);
    expect(isLiesError(challenged)).toBe(false);
    if (isLiesError(challenged)) return;
    expect(challenged.lastReveal?.truthful).toBe(true);
    expect(challenged.lastReveal?.takenBy).toBe(1);
    expect(challenged.lastReveal?.lastBatch.map((c) => c.id)).toEqual(['a']);
    expect(challenged.lastReveal?.pileCards.map((c) => c.id)).toEqual(['a']);
    expect(challenged.hands[1]!.map((c) => c.id).sort()).toEqual(['a', 'c'].sort());
    expect(challenged.pile).toBeNull();
    expect(challenged.phase).toBe('claiming');
    expect(challenged.currentSeat).toBe(0);
  });

  it('challenge false → liar gets pile, challenger leads', () => {
    let state = createLiesGameSeeded(3, 1, 3, 0);
    state.hands = [
      [std('a', 9), std('b', 6)],
      [std('c', 7)],
      [std('d', 8)],
    ];
    const led = applyLiesClaim(state, 0, ['a'], 5);
    expect(isLiesError(led)).toBe(false);
    if (isLiesError(led)) return;
    const challenged = applyLiesChallenge(led, 1);
    expect(isLiesError(challenged)).toBe(false);
    if (isLiesError(challenged)) return;
    expect(challenged.lastReveal?.truthful).toBe(false);
    expect(challenged.lastReveal?.takenBy).toBe(0);
    expect(challenged.lastReveal?.lastBatch.map((c) => c.id)).toEqual(['a']);
    expect(challenged.lastReveal?.pileCards.length).toBe(1);
    expect(challenged.lastReveal?.takenCount).toBe(1);
    expect(challenged.hands[0]!.map((c) => c.id).sort()).toEqual(['a', 'b'].sort());
    expect(challenged.pile).toBeNull();
    expect(challenged.currentSeat).toBe(1);
  });

  it('public reveal shows full pile only to the taker', () => {
    let state = createLiesGameSeeded(3, 1, 5, 0);
    state.hands = [
      [std('a', 5), std('b', 9)],
      [std('c', 7), std('extra', 3)],
      [std('d', 8)],
    ];
    let next = applyLiesClaim(state, 0, ['a'], 5);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    next = applyLiesBelieve(next, 1);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    next = applyLiesClaim(next, 2, ['d'], 5);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    next = applyLiesChallenge(next, 0);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.lastReveal?.truthful).toBe(false);
    expect(next.lastReveal?.takenBy).toBe(2);
    expect(next.lastReveal?.lastBatch.map((c) => c.id)).toEqual(['d']);
    expect(next.lastReveal?.takenCount).toBe(2);

    const takerView = toPublicLiesView(next, 2);
    const otherView = toPublicLiesView(next, 0);
    const bystanderView = toPublicLiesView(next, 1);
    expect(takerView.lastReveal?.pileCards.map((c) => c.id).sort()).toEqual(['a', 'd'].sort());
    expect(otherView.lastReveal?.pileCards).toEqual([]);
    expect(bystanderView.lastReveal?.pileCards).toEqual([]);
    expect(otherView.lastReveal?.lastBatch.map((c) => c.id)).toEqual(['d']);
    expect(otherView.lastReveal?.takenCount).toBe(2);
  });

  it('full believe + clear removes pile from game', () => {
    let state = createLiesGameSeeded(3, 1, 4, 0);
    state.hands = [
      [std('a', 4), std('b', 4)],
      [std('c', 5)],
      [std('d', 6)],
    ];
    let next = applyLiesClaim(state, 0, ['a'], 4);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    next = applyLiesBelieve(next, 1);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    next = applyLiesBelieve(next, 2);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.phase).toBe('lastConfirm');
    expect(next.currentSeat).toBe(0);
    next = applyLiesClear(next, 0);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.pile).toBeNull();
    expect(next.removedCount).toBe(1);
    expect(next.phase).toBe('claiming');
    expect(next.currentSeat).toBe(0);
    expect(next.hands.flat().length + next.undealt.length + next.removedCount).toBe(
      state.hands.flat().length + state.undealt.length,
    );
  });

  it('empty hand ranks after believe; does not end before responders act', () => {
    let state = createLiesGameSeeded(3, 1, 5, 0);
    state.hands = [[std('a', 3)], [std('b', 4), std('c', 5)], [std('d', 6)]];
    let next = applyLiesClaim(state, 0, ['a'], 3);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.finishOrder).toEqual([0]);
    // Still need believe/lie — hand must not complete yet.
    expect(next.phase).toBe('responding');
    expect(next.phase).not.toBe('handComplete');

    next = applyLiesBelieve(next, 1);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    next = applyLiesBelieve(next, 2);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.phase).toBe('lastConfirm');
    expect(next.finishOrder).toEqual([0]);

    next = applyLiesClear(next, 0);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.finishOrder).toEqual([0]);
    expect(next.phase).toBe('claiming');
  });

  it('two empties in the same round: first empty is rank 1; responders still act', () => {
    let state = createLiesGameSeeded(3, 1, 6, 0);
    state.hands = [[std('a', 5)], [std('b', 5)], [std('c', 9), std('d', 10)]];
    let next = applyLiesClaim(state, 0, ['a'], 5);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.finishOrder).toEqual([0]);
    expect(next.phase).toBe('responding');
    expect(next.currentSeat).toBe(1);

    // Seat 1 adds last card in the same pile round.
    next = applyLiesClaim(next, 1, ['b'], 5);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.finishOrder).toEqual([0, 1]);
    // Seat 2 must still believe or call lie — do not end the hand yet.
    expect(next.phase).toBe('responding');
    expect(next.currentSeat).toBe(2);
    expect(next.phase).not.toBe('handComplete');

    next = applyLiesBelieve(next, 2);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.phase).toBe('lastConfirm');
    next = applyLiesClear(next, 1);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    // Only seat 2 left → they take last place and hand completes.
    expect(next.phase).toBe('handComplete');
    expect(next.finishOrder).toEqual([0, 1, 2]);
  });

  it('failed challenge revives the emptier so they do not keep the place', () => {
    let state = createLiesGameSeeded(3, 1, 7, 0);
    state.hands = [[std('a', 9)], [std('b', 4)], [std('c', 5)]];
    let next = applyLiesClaim(state, 0, ['a'], 3); // bluff
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.finishOrder).toEqual([0]);
    next = applyLiesChallenge(next, 1);
    expect(isLiesError(next)).toBe(false);
    if (isLiesError(next)) return;
    expect(next.lastReveal?.truthful).toBe(false);
    expect(next.finishOrder).not.toContain(0);
    expect(next.hands[0]!.length).toBeGreaterThan(0);
  });

  it('public view hides other hands and shows pile count', () => {
    const state = createLiesGame({ playerCount: 4, deckCount: 1, random: createSeededRandom(9), openingSeat: 0 });
    const view = toPublicLiesView(state, 0);
    expect(view.mode).toBe('lies');
    expect(view.ownHand.length).toBe(state.hands[0]!.length);
    expect(view.cardCounts.length).toBe(4);
    expect(view.pileCount).toBe(0);
  });
});

describe('lies platform smoke', () => {
  it('setMatchMode lies + start + one bot turn', () => {
    const store = tempStore();
    const host = store.auth(store.guest('lieshost1').token)!;
    const game = store.createGame(host);
    store.setMatchMode(host, game, 'lies');
    expect(game.mode).toBe('lies');
    expect(game.seats.length).toBeGreaterThanOrEqual(3);
    store.setLiesPlayerCount(host, game, 3);
    store.setLiesDeckCount(host, game, 1);
    // fill bots
    for (let i = 0; i < game.seats.length; i += 1) {
      const seat = game.seats[i]!;
      if (!seat.userId) {
        seat.isBot = true;
        seat.botName = `Bot${i}`;
        seat.connection = 'connected';
        seat.lobbyReady = true;
      }
    }
    startMatch(game);
    expect(game.lies).toBeTruthy();
    expect(game.match).toBeNull();
    expect(game.status).toBe('playing');
    // Force a bot to act first so autoAct has work.
    if (game.lies) {
      const botSeat = game.seats.findIndex((seat, index) => seat.isBot && index > 0);
      game.lies.currentSeat = (botSeat >= 0 ? botSeat : 1) as 0 | 1 | 2 | 3 | 4 | 5;
    }
    const acted = autoAct(game);
    expect(acted).toBe(true);
    const payload = payloadFor(game, host.id);
    expect(payload?.view.mode).toBe('lies');
  });

  it('turnDelay uses classic bot/human clocks after fx', () => {
    const store = tempStore();
    const host = store.auth(store.guest('lieshost3').token)!;
    const game = store.createGame(host);
    store.setMatchMode(host, game, 'lies');
    store.setLiesPlayerCount(host, game, 3);
    for (let i = 0; i < game.seats.length; i += 1) {
      const seat = game.seats[i]!;
      if (!seat.userId) {
        seat.isBot = true;
        seat.botName = `Bot${i}`;
        seat.connection = 'connected';
        seat.lobbyReady = true;
      }
    }
    startMatch(game);
    expect(game.lies).toBeTruthy();
    if (!game.lies) return;
    game.lies.lastPlay = null;
    game.lies.lastReveal = null;
    const botSeat = game.seats.findIndex((seat) => seat.isBot);
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id);
    game.lies.currentSeat = botSeat as 0 | 1 | 2 | 3 | 4 | 5;
    expect(turnDelay(game)).toBe(1200);
    game.lies.currentSeat = hostSeat as 0 | 1 | 2 | 3 | 4 | 5;
    expect(turnDelay(game)).toBe(20_000);
  });

  it('autoAct times out a connected human on lies', () => {
    const store = tempStore();
    const host = store.auth(store.guest('lieshost2').token)!;
    const game = store.createGame(host);
    store.setMatchMode(host, game, 'lies');
    store.setLiesPlayerCount(host, game, 3);
    store.setLiesDeckCount(host, game, 1);
    for (let i = 0; i < game.seats.length; i += 1) {
      const seat = game.seats[i]!;
      if (!seat.userId) {
        seat.isBot = true;
        seat.botName = `Bot${i}`;
        seat.connection = 'connected';
        seat.lobbyReady = true;
      }
    }
    startMatch(game);
    expect(game.lies).toBeTruthy();
    if (!game.lies) return;
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id);
    expect(hostSeat).toBeGreaterThanOrEqual(0);
    game.lies.currentSeat = hostSeat as 0 | 1 | 2 | 3 | 4 | 5;
    game.lies.phase = 'claiming';
    game.lies.pile = null;
    game.lies.claimedRank = null;
    game.lies.lastClaim = null;
    const before = game.lies.history.length;
    expect(game.seats[hostSeat]?.isBot).toBe(false);
    expect(game.seats[hostSeat]?.connection).toBe('connected');
    expect(autoAct(game)).toBe(true);
    expect(game.lies.history.length).toBeGreaterThan(before);
  });
});
