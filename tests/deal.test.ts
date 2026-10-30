import {
  createDeck,
  createGame,
  createSeededRandom,
  dealerForHand,
  dealCards,
  THREE_OF_SPADES_ID,
} from '../src/domain';
import { dealtFromSeed } from './helpers';

describe('dealing', () => {
  it('gives four hands that contain every card, sizes 14, 14, 13, 13', () => {
    const hands = dealCards(createDeck(), 0);
    const sizes = hands.map((hand) => hand.length).sort((a, b) => b - a);
    expect(sizes).toEqual([14, 14, 13, 13]);
    const ids = hands.flat().map((card) => card.id);
    expect(ids).toHaveLength(54);
    expect(new Set(ids).size).toBe(54);
  });

  it('gives the extra cards to the first two clockwise recipients (dealOrder)', () => {
    const hands = dealCards(createDeck(), 0);
    expect(hands[1]).toHaveLength(14);
    expect(hands[2]).toHaveLength(14);
    expect(hands[3]).toHaveLength(13);
    expect(hands[0]).toHaveLength(13);
  });

  it('starts left of the dealer and rotates the dealer each hand', () => {
    expect(dealerForHand(0)).toBe(0);
    expect(dealerForHand(1)).toBe(1);
    expect(dealerForHand(4)).toBe(0);
    const fromDealer1 = dealCards(createDeck(), 1);
    expect(fromDealer1[2]).toHaveLength(14);
    expect(fromDealer1[3]).toHaveLength(14);
    expect(fromDealer1[0]).toHaveLength(13);
    expect(fromDealer1[1]).toHaveLength(13);
  });

  it('deals deterministically with a seeded shuffle', () => {
    const a = dealtFromSeed(7);
    const b = dealtFromSeed(7);
    expect(a.map((hand) => hand.map((card) => card.id))).toEqual(
      b.map((hand) => hand.map((card) => card.id)),
    );
  });

  it('opens the first hand from the 3♠ holder when configured', () => {
    const game = createGame({ mode: '2v2', random: createSeededRandom(11) });
    const holder = game.hands.findIndex((hand) =>
      hand.some((card) => card.id === THREE_OF_SPADES_ID),
    );
    expect(game.currentSeat).toBe(holder);
    expect(game.dealerSeat).toBe(0);
  });
});
