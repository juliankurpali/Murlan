import {
  cardStrength,
  compareCards,
  createDeck,
  createSeededRandom,
  faceArtId,
  shuffleDeck,
} from '../src/domain';

describe('deck and ranks', () => {
  it('has exactly 54 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(54);
    expect(new Set(deck.map((card) => card.id)).size).toBe(54);
  });

  it('orders ranks 3 < … < 2 < black joker < red joker', () => {
    const deck = createDeck();
    const byId = Object.fromEntries(deck.map((card) => [card.id, card]));
    const ordered = ['S3', 'S4', 'S10', 'SJ', 'SQ', 'SK', 'SA', 'S2', 'JB', 'JR'].map(
      (id) => byId[id]!,
    );
    for (let i = 1; i < ordered.length; i += 1) {
      expect(cardStrength(ordered[i]!)).toBeGreaterThan(cardStrength(ordered[i - 1]!));
      expect(compareCards(ordered[i - 1]!, ordered[i]!)).toBeLessThan(0);
    }
  });

  it('maps Super duplicate ids onto classic face-art keys', () => {
    expect(faceArtId({ id: 'S3#0', kind: 'standard', suit: 'spades', rank: 3 })).toBe('S3');
    expect(faceArtId({ id: 'HA#5', kind: 'standard', suit: 'hearts', rank: 14 })).toBe('HA');
    expect(faceArtId({ id: 'JB#1', kind: 'joker', color: 'black' })).toBe('JB');
    expect(faceArtId({ id: 'JR#0', kind: 'joker', color: 'red' })).toBe('JR');
    expect(faceArtId({ id: 'C2', kind: 'standard', suit: 'clubs', rank: 15 })).toBe('C2');
  });

  it('shuffles deterministically with the same seed', () => {
    const a = shuffleDeck(createDeck(), createSeededRandom(42));
    const b = shuffleDeck(createDeck(), createSeededRandom(42));
    const c = shuffleDeck(createDeck(), createSeededRandom(43));
    expect(a.map((card) => card.id)).toEqual(b.map((card) => card.id));
    expect(a.map((card) => card.id)).not.toEqual(c.map((card) => card.id));
  });
});
