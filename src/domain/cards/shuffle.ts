import { Card } from './types';
import { RandomSource } from './random';

export function shuffleDeck(deck: Card[], random: RandomSource): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const current = result[i];
    const swap = result[j];
    if (current === undefined || swap === undefined) {
      throw new Error('Shuffle index out of range');
    }
    result[i] = swap;
    result[j] = current;
  }
  return result;
}
