import {
  canBeat,
  createDeck,
  createGame,
  createSeededRandom,
  createSuperDeck,
  dealCards,
  dealLimited,
  DEFAULT_RULES,
  detectCombination,
  getLegalMoves,
  isCombination,
  pickSpiceKind,
  spiceDeck,
  SUPER_MURLAN,
  validateSuperDeck,
} from '../src/domain';
import { Combination, TrickState } from '../src/domain/game/types';

const EMPTY_TRICK: TrickState = {
  leaderSeat: 0,
  combination: null,
  lastSuccessfulSeat: null,
  passedSinceLastPlay: [],
};

function combosOf(hand: ReturnType<typeof createDeck>): Combination[] {
  return getLegalMoves(hand, EMPTY_TRICK, DEFAULT_RULES)
    .map((cards) => detectCombination(cards, DEFAULT_RULES))
    .filter(isCombination);
}

function bombs(hand: ReturnType<typeof createDeck>): Combination[] {
  return combosOf(hand).filter((combo) => combo.type === 'bomb');
}

function runs(
  hand: ReturnType<typeof createDeck>,
  type: 'straight' | 'flush',
): Combination[] {
  return combosOf(hand).filter((combo) => combo.type === type && combo.length >= 5);
}

function longestStraight(hand: ReturnType<typeof createDeck>): number {
  const values = [
    ...new Set(
      hand.flatMap((card) => {
        if (card.kind !== 'standard') {
          return [];
        }
        return [card.rank === 15 ? 2 : card.rank];
      }),
    ),
  ].sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  let previous = Number.NaN;
  for (const value of values) {
    current = value === previous + 1 ? current + 1 : 1;
    previous = value;
    if (current > best) {
      best = current;
    }
  }
  if (values.includes(14) && values.includes(2)) {
    let low = 2;
    for (let rank = 3; rank <= 13; rank += 1) {
      if (!values.includes(rank)) {
        break;
      }
      low += 1;
    }
    if (low > best) {
      best = low;
    }
  }
  return best;
}

function spicedHands(
  seed: number,
  kind: Parameters<typeof spiceDeck>[0]['kind'],
  mode: '2v2' | 'super' = '2v2',
) {
  const random = createSeededRandom(seed);
  const dealerSeat = 0;
  const seatCount = mode === 'super' ? 6 : 4;
  const deck =
    mode === 'super'
      ? spiceDeck({
          deck: createSuperDeck(random),
          dealerSeat,
          seatCount,
          dealtCount: seatCount * SUPER_MURLAN.cardsPerPlayer,
          random,
          teamOf: [0, 1, 2, 0, 1, 2],
          kind,
        })
      : spiceDeck({
          deck: createDeck(),
          dealerSeat,
          seatCount,
          dealtCount: 54,
          random,
          teamOf: [0, 1, 0, 1],
          kind,
        });
  if (mode === 'super') {
    validateSuperDeck(deck);
    return dealLimited(deck, dealerSeat, seatCount, SUPER_MURLAN.cardsPerPlayer);
  }
  return { hands: dealCards(deck, dealerSeat, seatCount), undealt: [] as typeof deck };
}

describe('interesting deals', () => {
  it('keeps a full unique deck and classic hand sizes', () => {
    const { hands, undealt } = spicedHands(3, 'breakableStraight');
    expect(undealt).toHaveLength(0);
    expect(hands.map((hand) => hand.length).sort((a, b) => b - a)).toEqual([14, 14, 13, 13]);
    expect(hands.every((hand) => hand.length === 13 || hand.length === 14)).toBe(true);
    const ids = hands.flat().map((card) => card.id);
    expect(ids).toHaveLength(54);
    expect(new Set(ids).size).toBe(54);
  });

  it('never deals 15 cards in classic, even across many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const game = createGame({ random: createSeededRandom(seed * 13) });
      expect(game.hands.map((hand) => hand.length).sort((a, b) => b - a)).toEqual([14, 14, 13, 13]);
      expect(game.hands.flat()).toHaveLength(54);
    }
  });

  it('plants short straights, not 3 through Ace', () => {
    for (const kind of ['straight', 'breakableStraight', 'straightVsBomb', 'flushRun'] as const) {
      let playable = 0;
      for (let seed = 0; seed < 8; seed += 1) {
        const { hands } = spicedHands(21 + kind.length * 10 + seed, kind);
        for (const hand of hands) {
          expect(hand.length).toBeLessThanOrEqual(14);
          expect(longestStraight(hand)).toBeLessThanOrEqual(6);
        }
        if (
          hands.some((hand) =>
            runs(hand, kind === 'flushRun' ? 'flush' : 'straight').some(
              (combo) => combo.length >= 5 && combo.length <= 6,
            ),
          )
        ) {
          playable += 1;
        }
      }
      expect(playable).toBeGreaterThan(0);
    }
  });

  it('can plant a bomb in one hand', () => {
    const { hands } = spicedHands(12, 'bomb');
    expect(hands.some((hand) => bombs(hand).length > 0)).toBe(true);
  });

  it('can plant a straight in one hand', () => {
    const { hands } = spicedHands(21, 'straight');
    expect(hands.some((hand) => runs(hand, 'straight').length > 0)).toBe(true);
  });

  it('gives one player a straight another player can beat', () => {
    const { hands } = spicedHands(44, 'breakableStraight');
    const straights = hands.map((hand) => runs(hand, 'straight'));
    let beatable = false;
    for (let a = 0; a < straights.length; a += 1) {
      for (let b = 0; b < straights.length; b += 1) {
        if (a === b) {
          continue;
        }
        beatable = straights[a]!.some((low) =>
          straights[b]!.some((high) => canBeat(high, low, DEFAULT_RULES)),
        );
        if (beatable) {
          break;
        }
      }
      if (beatable) {
        break;
      }
    }
    expect(beatable).toBe(true);
  });

  it('can give a straight to one seat and a bomb to another', () => {
    const { hands } = spicedHands(61, 'straightVsBomb');
    expect(hands.some((hand) => runs(hand, 'straight').length > 0)).toBe(true);
    expect(hands.some((hand) => bombs(hand).length > 0)).toBe(true);
  });

  it('can give bombs to two seats', () => {
    const { hands } = spicedHands(77, 'duelBomb');
    expect(hands.filter((hand) => bombs(hand).length > 0).length).toBeGreaterThanOrEqual(2);
  });

  it('can plant a flush run', () => {
    const { hands } = spicedHands(90, 'flushRun');
    expect(hands.some((hand) => runs(hand, 'flush').length > 0)).toBe(true);
  });

  it('still deals Super as 13 each with four undealt', () => {
    const { hands, undealt } = spicedHands(8, 'breakableStraight', 'super');
    expect(hands).toHaveLength(6);
    expect(hands.every((hand) => hand.length === 13)).toBe(true);
    expect(undealt).toHaveLength(4);
    expect(hands.flat().length + undealt.length).toBe(82);
    expect(hands.some((hand) => runs(hand, 'straight').length > 0)).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = spicedHands(19, 'bomb').hands.map((hand) => hand.map((card) => card.id));
    const b = spicedHands(19, 'bomb').hands.map((hand) => hand.map((card) => card.id));
    expect(a).toEqual(b);
  });

  it('leaves most rolls as mixed fun rather than always fair', () => {
    const counts = new Map<string, number>();
    const random = createSeededRandom(101);
    for (let i = 0; i < 1000; i += 1) {
      const kind = pickSpiceKind(random);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    expect(counts.get('fair') ?? 0).toBeGreaterThan(220);
    expect(counts.get('fair') ?? 0).toBeLessThan(380);
    expect((counts.get('straight') ?? 0) + (counts.get('breakableStraight') ?? 0)).toBeGreaterThan(350);
    expect(counts.get('bomb') ?? 0).toBeGreaterThan(80);
  });

  it('makes live deals hit bombs or straights often', () => {
    let interesting = 0;
    for (let seed = 1; seed <= 24; seed += 1) {
      const game = createGame({ random: createSeededRandom(seed * 17) });
      const hit = game.hands.some(
        (hand) => bombs(hand).length > 0 || runs(hand, 'straight').length > 0 || runs(hand, 'flush').length > 0,
      );
      if (hit) {
        interesting += 1;
      }
    }
    expect(interesting).toBeGreaterThanOrEqual(12);
  });
});
