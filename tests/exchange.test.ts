import {
  applyCardExchange,
  Card,
  completeExchangeReturn,
  createSeededRandom,
  hasBothJokers,
  isRuleError,
  lastPlaceSeat,
  startNextHand,
} from '../src/domain';
import { C, createPlayingState } from './helpers';

describe('between-hand card exchange', () => {
  it('treats the leftover seat as last place when three players have finished', () => {
    expect(lastPlaceSeat([2, 0, 1])).toBe(3);
    expect(lastPlaceSeat([0, 1, 2, 3])).toBe(3);
  });

  it('uses first and last from a Super finish order', () => {
    expect(lastPlaceSeat([4, 1, 0, 5, 2], 6)).toBe(3);
    expect(lastPlaceSeat([4, 1, 0, 5, 2, 3], 6)).toBe(3);
  });

  it('gives last place’s highest card to first place, who returns a 3–10 by default', () => {
    const { hands, exchange } = applyCardExchange(
      [C('S3', 'HK'), C('S4', 'S5'), C('S6', 'S7'), C('JR', 'S8')],
      { enabled: true, firstSeat: 0, lastSeat: 3 },
    );
    expect(exchange).toEqual({
      kind: 'swap',
      firstSeat: 0,
      lastSeat: 3,
      givenToFirst: expect.objectContaining({ id: 'JR' }),
      returnedToLast: expect.objectContaining({ id: 'S3' }),
    });
    expect(hands[0].map((card) => card.id).sort()).toEqual(['HK', 'JR']);
    expect(hands[3].map((card) => card.id).sort()).toEqual(['S3', 'S8']);
  });

  it('returns the lowest remaining card if first place holds no 3–10', () => {
    const { exchange } = applyCardExchange(
      [C('HA', 'H2', 'HK'), C('S4'), C('S5'), C('JR', 'S8')],
      { enabled: true, firstSeat: 0, lastSeat: 3 },
    );
    expect(exchange?.kind).toBe('swap');
    if (exchange?.kind === 'swap') {
      expect(exchange.givenToFirst.id).toBe('JR');
      expect(exchange.returnedToLast.id).toBe('HK');
    }
  });

  it('lets first place choose the card given to last place', () => {
    const { hands, exchange } = applyCardExchange(
      [C('S3', 'HK'), C('S4'), C('S5'), C('JR', 'S8')],
      { enabled: true, firstSeat: 0, lastSeat: 3, returnedCard: C('HK')[0] },
    );
    expect(exchange?.kind).toBe('swap');
    if (exchange?.kind === 'swap') {
      expect(exchange.returnedToLast.id).toBe('HK');
    }
    expect(hands[0].map((card) => card.id).sort()).toEqual(['JR', 'S3']);
    expect(hands[3].map((card) => card.id).sort()).toEqual(['HK', 'S8']);
  });

  it('pauses for a return choice when requested', () => {
    const { hands, exchange, pending } = applyCardExchange(
      [C('S3', 'HK'), C('S4'), C('S5'), C('JR', 'S8')],
      { enabled: true, firstSeat: 0, lastSeat: 3, awaitReturnChoice: true },
    );
    expect(exchange).toBeNull();
    expect(pending?.givenToFirst.id).toBe('JR');
    expect(hands[0].map((card) => card.id).sort()).toEqual(['HK', 'JR', 'S3']);
    expect(hands[3].map((card) => card.id)).toEqual(['S8']);
  });

  it('skips the exchange when last place holds both jokers', () => {
    const original: [Card[], Card[], Card[], Card[]] = [C('S3', 'HK'), C('S4'), C('S5'), C('JB', 'JR', 'S8')];
    expect(hasBothJokers(original[3]!)).toBe(true);
    const { hands, exchange, pending } = applyCardExchange(original, {
      enabled: true,
      firstSeat: 0,
      lastSeat: 3,
    });
    expect(pending).toBeNull();
    expect(exchange).toEqual({
      kind: 'skipped',
      firstSeat: 0,
      lastSeat: 3,
      reason: 'bothJokers',
    });
    expect(hands).toEqual(original);
  });

  it('does nothing on the first hand or when disabled', () => {
    const original: [Card[], Card[], Card[], Card[]] = [C('S3'), C('S4'), C('S5'), C('JR')];
    expect(
      applyCardExchange(original, { enabled: false, firstSeat: 0, lastSeat: 3 }).exchange,
    ).toBeNull();
    expect(
      applyCardExchange(original, { enabled: true, firstSeat: null, lastSeat: 3 }).exchange,
    ).toBeNull();
  });

  it('completes a pending human return and then last place leads', () => {
    const state = createPlayingState({
      mode: '2v2',
      phase: 'exchanging',
      currentSeat: 0,
      pendingExchange: {
        firstSeat: 0,
        lastSeat: 3,
        givenToFirst: C('JR')[0]!,
      },
      hands: [C('S3', 'HK', 'JR'), C('S4'), C('S5'), C('S8')],
    });
    const next = completeExchangeReturn(state, 0, C('HK')[0]!);
    if (isRuleError(next)) {
      throw new Error(next.message);
    }
    expect(next.phase).toBe('playing');
    expect(next.currentSeat).toBe(3);
    expect(next.trick.leaderSeat).toBe(3);
    expect(next.lastExchange?.kind).toBe('swap');
    expect(next.hands[0].map((card) => card.id).sort()).toEqual(['JR', 'S3']);
    expect(next.hands[3].map((card) => card.id).sort()).toEqual(['HK', 'S8']);
  });

  it('refuses giving back the card just received', () => {
    const state = createPlayingState({
      phase: 'exchanging',
      pendingExchange: {
        firstSeat: 0,
        lastSeat: 3,
        givenToFirst: C('JR')[0]!,
      },
      hands: [C('S3', 'JR'), C('S4'), C('S5'), C('S8')],
    });
    const next = completeExchangeReturn(state, 0, C('JR')[0]!);
    expect(isRuleError(next)).toBe(true);
    if (isRuleError(next)) {
      expect(next.code).toBe('invalidExchangeCard');
    }
  });

  it('runs after the next-hand deal, last leads after a swap, and keeps a 54-card unique deck', () => {
    const state = createPlayingState({
      mode: '2v2',
      phase: 'handComplete',
      finishOrder: [2, 0, 1],
      hands: [C('S3'), C('S4'), C('S5'), C('S6')],
    });
    const next = startNextHand(state, { ...state.rules, cardExchangeEnabled: true }, createSeededRandom(3));
    if (isRuleError(next)) {
      throw new Error(next.message);
    }
    const ids = next.hands.flat().map((card) => card.id);
    expect(ids).toHaveLength(54);
    expect(new Set(ids).size).toBe(54);
    expect(next.lastExchange).not.toBeNull();
    expect(next.lastExchange?.firstSeat).toBe(2);
    expect(next.lastExchange?.lastSeat).toBe(3);
    if (next.lastExchange?.kind === 'skipped') {
      expect(next.currentSeat).toBe(2);
      expect(hasBothJokers(next.hands[3]!)).toBe(true);
    } else {
      expect(next.currentSeat).toBe(3);
      expect(next.trick.leaderSeat).toBe(3);
    }
  });

  it('exchanges between Super first and last after the next-hand deal', () => {
    const state = createPlayingState({
      mode: 'super',
      phase: 'handComplete',
      finishOrder: [4, 1, 0, 5, 2, 3],
      hands: [C('S3'), C('S4'), C('S5'), C('S6'), C('S7'), C('S8')],
      teamOf: [0, 1, 2, 0, 1, 2],
      rules: {
        flushEnabled: true,
        flushBeatsBomb: true,
        aceLowStraightEnabled: true,
        aceHighStraightEnabled: true,
        firstLeadMustContainThreeOfSpades: false,
        cardExchangeEnabled: true,
        targetScore: 150,
        tieTargetIncrement: 10,
        pointsByFinishOrder: [15, 12, 9, 6, 3, 1],
        minimumWinningLead: 10,
        allowReentryAfterPass: true,
        laterHandOpener: 'previousFirstFinisher',
        fourteenCardPolicy: 'dealOrder',
        allowPassOnLead: false,
      },
    });
    const next = startNextHand(state, state.rules, createSeededRandom(11), { awaitReturnChoice: true });
    if (isRuleError(next)) {
      throw new Error(next.message);
    }
    expect(next.hands).toHaveLength(6);
    expect(next.undealt).toHaveLength(4);
    expect(next.hands.flat().length + next.undealt.length).toBe(82);
    if (next.pendingExchange) {
      expect(next.pendingExchange.firstSeat).toBe(4);
      expect(next.pendingExchange.lastSeat).toBe(3);
      expect(next.phase).toBe('exchanging');
      expect(next.currentSeat).toBe(4);
      expect(next.hands[4]).toHaveLength(14);
      expect(next.hands[3]).toHaveLength(12);
      return;
    }
    expect(next.lastExchange).not.toBeNull();
    expect(next.lastExchange?.firstSeat).toBe(4);
    expect(next.lastExchange?.lastSeat).toBe(3);
    if (next.lastExchange?.kind === 'skipped') {
      expect(next.currentSeat).toBe(4);
    } else {
      expect(next.currentSeat).toBe(3);
    }
  });
});
