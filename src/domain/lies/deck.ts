import { createDeck } from '../cards/deck';
import { createSeededRandom, RandomSource } from '../cards/random';
import { shuffleDeck } from '../cards/shuffle';
import { Card } from '../cards/types';
import { SeatId } from '../game/types';

export function maxPlayFor(deckCount: 1 | 2): number {
  return 4 * deckCount;
}

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build jokerless decks and deal round-robin as evenly as possible; leftovers stay undealt. */
export function dealLies(
  playerCount: number,
  deckCount: 1 | 2,
  random: RandomSource = createSeededRandom(Date.now() >>> 0),
): { hands: Card[][]; undealt: Card[] } {
  if (playerCount < 3 || playerCount > 6) {
    throw new Error(`Lies requires 3–6 players, got ${playerCount}`);
  }
  const deck: Card[] = [];
  for (let d = 0; d < deckCount; d += 1) {
    for (const card of createDeck()) {
      if (card.kind === 'joker') continue;
      deck.push({
        ...card,
        id: deckCount === 1 ? card.id : `${card.id}#d${d}`,
      });
    }
  }
  const shuffled = shuffleDeck(deck, random);
  const perPlayer = Math.floor(shuffled.length / playerCount);
  const dealCount = perPlayer * playerCount;
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  for (let idx = 0; idx < dealCount; idx += 1) {
    hands[idx % playerCount]!.push(shuffled[idx]!);
  }
  return { hands, undealt: shuffled.slice(dealCount) };
}

export function activeSeats(playerCount: number): SeatId[] {
  return Array.from({ length: playerCount }, (_, i) => i as SeatId);
}

export function nextClockwise(seat: SeatId, playerCount: number): SeatId {
  return ((seat + 1) % playerCount) as SeatId;
}
