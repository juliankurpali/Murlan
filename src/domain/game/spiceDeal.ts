import { Card, StandardCard, StandardRank, Suit } from '../cards/types';
import { RandomSource } from '../cards/random';
import { dealCards, dealLimited } from './deal';
import { SeatId } from './types';

/** High-straight display order: 2, then 3–A. */
const STRAIGHT_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export type SpiceDealKind =
  | 'fair'
  | 'bomb'
  | 'straight'
  | 'breakableStraight'
  | 'straightVsBomb'
  | 'duelBomb'
  | 'flushRun';

type Gift = { seat: SeatId; cards: Card[]; blockValues?: number[] };

function shuffleItems<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const current = result[i];
    const swap = result[j];
    if (current === undefined || swap === undefined) {
      continue;
    }
    result[i] = swap;
    result[j] = current;
  }
  return result;
}

function pickItem<T>(items: T[], random: RandomSource): T | null {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(random.next() * items.length)] ?? null;
}

function rankFromStraightValue(value: number): StandardRank {
  return (value === 2 ? 15 : value) as StandardRank;
}

function straightWindows(length: number): number[][] {
  const windows: number[][] = [];
  for (let i = 0; i + length <= STRAIGHT_VALUES.length; i += 1) {
    windows.push([...STRAIGHT_VALUES.slice(i, i + length)]);
  }
  return windows;
}

function windowStrength(window: number[]): number {
  return Math.max(...window);
}

function dealSeatAtIndex(index: number, dealerSeat: SeatId, seatCount: number): SeatId {
  return ((dealerSeat + 1 + index) % seatCount) as SeatId;
}

function slotsForSeat(
  seat: SeatId,
  dealerSeat: SeatId,
  seatCount: number,
  dealtCount: number,
): number[] {
  const slots: number[] = [];
  for (let index = 0; index < dealtCount; index += 1) {
    if (dealSeatAtIndex(index, dealerSeat, seatCount) === seat) {
      slots.push(index);
    }
  }
  return slots;
}

function availableOfRank(pool: Card[], rank: StandardRank, taken: Set<string>): StandardCard[] {
  return pool.filter(
    (card): card is StandardCard =>
      card.kind === 'standard' && card.rank === rank && !taken.has(card.id),
  );
}

function takeOfRank(
  pool: Card[],
  rank: StandardRank,
  count: number,
  taken: Set<string>,
): StandardCard[] | null {
  const found = availableOfRank(pool, rank, taken).slice(0, count);
  if (found.length < count) {
    return null;
  }
  for (const card of found) {
    taken.add(card.id);
  }
  return found;
}

function takeRun(
  pool: Card[],
  values: number[],
  taken: Set<string>,
  options: { suit?: Suit; avoidFlush?: boolean } = {},
): StandardCard[] | null {
  const picked: StandardCard[] = [];
  let lastSuit: Suit | null = null;
  for (const value of values) {
    const rank = rankFromStraightValue(value);
    let candidates = availableOfRank(pool, rank, taken);
    if (options.suit) {
      candidates = candidates.filter((card) => card.suit === options.suit);
    } else if (options.avoidFlush && lastSuit && candidates.some((card) => card.suit !== lastSuit)) {
      candidates = candidates.filter((card) => card.suit !== lastSuit);
    }
    const card = candidates[0];
    if (!card) {
      return null;
    }
    picked.push(card);
    taken.add(card.id);
    lastSuit = card.suit;
  }
  return picked;
}

function pickSeats(
  random: RandomSource,
  seatCount: number,
  count: number,
  teamOf: number[],
): SeatId[] | null {
  if (count > seatCount) {
    return null;
  }
  const seats = shuffleItems(
    Array.from({ length: seatCount }, (_, index) => index as SeatId),
    random,
  );
  const first = seats[0];
  if (first === undefined) {
    return null;
  }
  if (count === 1) {
    return [first];
  }
  const team = teamOf[first];
  const opponents = seats.filter((seat) => seat !== first && teamOf[seat] !== team);
  const allies = seats.filter((seat) => seat !== first && !opponents.includes(seat));
  const ordered = [...opponents, ...allies];
  const picked = [first, ...ordered.slice(0, count - 1)];
  return picked.length === count ? picked : null;
}

function extensionBlocks(window: number[]): number[] {
  const min = Math.min(...window);
  const max = Math.max(...window);
  const blocked = [min - 2, min - 1, max + 1, max + 2];
  if (window.includes(2)) {
    blocked.push(14);
  }
  if (window.includes(14)) {
    blocked.push(2);
  }
  return blocked;
}

function straightValueOf(card: Card): number | null {
  if (card.kind !== 'standard') {
    return null;
  }
  return card.rank === 15 ? 2 : card.rank;
}

function pickBreakableWindows(random: RandomSource): { low: number[]; high: number[] } | null {
  const windows = straightWindows(5);
  const pairs: { low: number[]; high: number[] }[] = [];
  for (const low of windows) {
    const lowMax = windowStrength(low);
    for (const high of windows) {
      const highMin = Math.min(...high);
      if (highMin >= lowMax + 1 && highMin <= lowMax + 2 && windowStrength(high) > lowMax) {
        pairs.push({ low, high });
      }
    }
  }
  return pickItem(pairs, random);
}

function bombRanks(pool: Card[], taken: Set<string>, exclude: Set<StandardRank> = new Set()): StandardRank[] {
  const counts = new Map<StandardRank, number>();
  for (const card of pool) {
    if (card.kind !== 'standard' || taken.has(card.id) || exclude.has(card.rank)) {
      continue;
    }
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= 4).map(([rank]) => rank);
}

function giftBomb(
  pool: Card[],
  seat: SeatId,
  taken: Set<string>,
  random: RandomSource,
  exclude: Set<StandardRank> = new Set(),
): Gift | null {
  const rank = pickItem(bombRanks(pool, taken, exclude), random);
  if (rank === undefined || rank === null) {
    return null;
  }
  const cards = takeOfRank(pool, rank, 4, taken);
  return cards ? { seat, cards } : null;
}

function giftStraight(
  pool: Card[],
  seat: SeatId,
  taken: Set<string>,
  values: number[],
  options?: { suit?: Suit; avoidFlush?: boolean },
): Gift | null {
  const cards = takeRun(pool, values, taken, options ?? { avoidFlush: true });
  return cards ? { seat, cards, blockValues: extensionBlocks(values) } : null;
}

function buildGifts(
  kind: SpiceDealKind,
  pool: Card[],
  seatCount: number,
  teamOf: number[],
  random: RandomSource,
): Gift[] | null {
  if (kind === 'fair') {
    return [];
  }
  const taken = new Set<string>();
  if (kind === 'bomb') {
    const seats = pickSeats(random, seatCount, 1, teamOf);
    if (!seats) {
      return null;
    }
    const gift = giftBomb(pool, seats[0]!, taken, random);
    return gift ? [gift] : null;
  }
  if (kind === 'duelBomb') {
    const seats = pickSeats(random, seatCount, 2, teamOf);
    if (!seats) {
      return null;
    }
    const first = giftBomb(pool, seats[0]!, taken, random);
    if (!first) {
      return null;
    }
    const used = new Set(
      first.cards.flatMap((card) => (card.kind === 'standard' ? [card.rank] : [])),
    );
    const second = giftBomb(pool, seats[1]!, taken, random, used);
    return second ? [first, second] : null;
  }
  if (kind === 'flushRun') {
    const seats = pickSeats(random, seatCount, 1, teamOf);
    const window = pickItem(straightWindows(5), random);
    const suit = pickItem(['spades', 'hearts', 'diamonds', 'clubs'] as Suit[], random);
    if (!seats || !window || !suit) {
      return null;
    }
    const gift = giftStraight(pool, seats[0]!, taken, window, { suit });
    return gift ? [gift] : null;
  }

  if (kind === 'straight') {
    const seats = pickSeats(random, seatCount, 1, teamOf);
    const window = pickItem(straightWindows(5), random);
    if (!seats || !window) {
      return null;
    }
    const gift = giftStraight(pool, seats[0]!, taken, window);
    return gift ? [gift] : null;
  }

  const seats = pickSeats(random, seatCount, 2, teamOf);
  if (!seats) {
    return null;
  }
  if (kind === 'breakableStraight') {
    const pair = pickBreakableWindows(random);
    if (!pair) {
      return null;
    }
    const low = giftStraight(pool, seats[0]!, taken, pair.low);
    const high = low ? giftStraight(pool, seats[1]!, taken, pair.high) : null;
    return low && high ? [low, high] : null;
  }

  const window = pickItem(straightWindows(5), random);
  if (!window) {
    return null;
  }
  const straight = giftStraight(pool, seats[0]!, taken, window);
  if (!straight) {
    return null;
  }
  const used = new Set(window.map(rankFromStraightValue));
  const bomb = giftBomb(pool, seats[1]!, taken, random, used);
  return bomb ? [straight, bomb] : null;
}

function placeGifts(
  deck: Card[],
  gifts: Gift[],
  dealerSeat: SeatId,
  seatCount: number,
  dealtCount: number,
  random: RandomSource,
): Card[] | null {
  const result: Array<Card | undefined> = Array.from({ length: deck.length });
  const taken = new Set<string>();
  for (const gift of gifts) {
    const slots = shuffleItems(slotsForSeat(gift.seat, dealerSeat, seatCount, dealtCount), random);
    if (slots.length < gift.cards.length) {
      return null;
    }
    for (let index = 0; index < gift.cards.length; index += 1) {
      const slot = slots[index];
      const card = gift.cards[index];
      if (slot === undefined || card === undefined || result[slot]) {
        return null;
      }
      result[slot] = card;
      taken.add(card.id);
    }
  }
  const leftover = deck.filter((card) => !taken.has(card.id));
  const blockedBySeat = new Map<SeatId, Set<number>>();
  for (const gift of gifts) {
    if (!gift.blockValues || gift.blockValues.length === 0) {
      continue;
    }
    const blocked = blockedBySeat.get(gift.seat) ?? new Set<number>();
    for (const value of gift.blockValues) {
      blocked.add(value);
    }
    blockedBySeat.set(gift.seat, blocked);
  }
  const used = new Set<number>();
  const takeLeftover = (allow: (card: Card) => boolean): Card | null => {
    for (let index = 0; index < leftover.length; index += 1) {
      if (used.has(index)) {
        continue;
      }
      const card = leftover[index];
      if (!card || !allow(card)) {
        continue;
      }
      used.add(index);
      return card;
    }
    return null;
  };
  for (let index = 0; index < result.length; index += 1) {
    if (result[index]) {
      continue;
    }
    const seat = dealSeatAtIndex(index, dealerSeat, seatCount);
    const blocked = blockedBySeat.get(seat);
    const allowed =
      takeLeftover((card) => {
        if (!blocked || blocked.size === 0) {
          return true;
        }
        const value = straightValueOf(card);
        return value === null || !blocked.has(value);
      }) ?? takeLeftover(() => true);
    if (!allowed) {
      return null;
    }
    result[index] = allowed;
  }
  if (used.size !== leftover.length) {
    return null;
  }
  const filled = result.filter((card): card is Card => card !== undefined);
  if (filled.length !== deck.length || new Set(filled.map((card) => card.id)).size !== deck.length) {
    return null;
  }
  return filled;
}

function uniqueStraightValues(hand: Card[]): number[] {
  const values = new Set<number>();
  for (const card of hand) {
    const value = straightValueOf(card);
    if (value !== null) {
      values.add(value);
    }
  }
  return [...values].sort((a, b) => a - b);
}

function longestRankRun(values: number[]): number[] {
  let best: number[] = [];
  let current: number[] = [];
  for (const value of values) {
    const last = current[current.length - 1];
    if (last !== undefined && value === last + 1) {
      current.push(value);
    } else {
      current = [value];
    }
    if (current.length > best.length) {
      best = current;
    }
  }
  if (values.includes(14) && values.includes(2)) {
    const low = [14];
    for (let rank = 2; rank <= 13; rank += 1) {
      if (!values.includes(rank)) {
        break;
      }
      low.push(rank);
    }
    if (low.length > best.length) {
      best = low;
    }
  }
  return best;
}

function rankCount(hand: Card[], rank: StandardRank): number {
  return hand.filter((card) => card.kind === 'standard' && card.rank === rank).length;
}

function swappedHand(hand: Card[], removeIndex: number, incoming: Card): Card[] {
  const next = hand.slice();
  next[removeIndex] = incoming;
  return next;
}

function runLength(hand: Card[]): number {
  return longestRankRun(uniqueStraightValues(hand)).length;
}

/** Split monster scales so a planted 5-card straight cannot grow into 3–A. */
export function limitStraightLength(
  hands: Card[][],
  maxLength: number,
  random: RandomSource,
): Card[][] {
  const next = hands.map((hand) => hand.slice());
  for (let attempt = 0; attempt < 64; attempt += 1) {
    let changed = false;
    for (let seat = 0; seat < next.length; seat += 1) {
      const hand = next[seat];
      if (!hand) {
        continue;
      }
      const beforeLen = runLength(hand);
      if (beforeLen <= maxLength) {
        continue;
      }
      const run = longestRankRun(uniqueStraightValues(hand));
      const singleton = run.filter(
        (value) => rankCount(hand, rankFromStraightValue(value)) === 1,
      );
      const splitValue =
        singleton[Math.floor(singleton.length / 2)] ?? run[Math.floor(run.length / 2)];
      if (splitValue === undefined) {
        continue;
      }
      const splitRank = rankFromStraightValue(splitValue);
      const fromIndex = hand.findIndex(
        (card) => card.kind === 'standard' && card.rank === splitRank,
      );
      if (fromIndex < 0) {
        continue;
      }
      const outgoing = hand[fromIndex];
      if (!outgoing) {
        continue;
      }
      const copies = rankCount(hand, splitRank);
      const others = shuffleItems(
        next.map((_, index) => index).filter((index) => index !== seat),
        random,
      );
      let swapped = false;
      for (const otherSeat of others) {
        const otherHand = next[otherSeat];
        if (!otherHand) {
          continue;
        }
        const order = shuffleItems(
          otherHand.map((_, index) => index),
          random,
        );
        for (const otherIndex of order) {
          const incoming = otherHand[otherIndex];
          if (!incoming) {
            continue;
          }
          const mine = swappedHand(hand, fromIndex, incoming);
          const theirs = swappedHand(otherHand, otherIndex, outgoing);
          const mineLen = runLength(mine);
          const theirLen = runLength(theirs);
          const progress =
            mineLen < beforeLen || rankCount(mine, splitRank) < copies;
          if (!progress || mineLen > beforeLen || theirLen > maxLength) {
            continue;
          }
          otherHand[otherIndex] = outgoing;
          hand[fromIndex] = incoming;
          swapped = true;
          changed = true;
          break;
        }
        if (swapped) {
          break;
        }
      }
    }
    if (!changed) {
      break;
    }
  }
  return next;
}

export function pickSpiceKind(random: RandomSource): SpiceDealKind {
  const roll = random.next();
  if (roll < 0.3) {
    return 'fair';
  }
  if (roll < 0.5) {
    return 'straight';
  }
  if (roll < 0.74) {
    return 'breakableStraight';
  }
  if (roll < 0.86) {
    return 'bomb';
  }
  if (roll < 0.94) {
    return 'straightVsBomb';
  }
  if (roll < 0.98) {
    return 'duelBomb';
  }
  return 'flushRun';
}

function rebuildDeck(hands: Card[][], dealerSeat: SeatId, undealt: Card[]): Card[] {
  const copies = hands.map((hand) => hand.slice());
  const out: Card[] = [];
  const seatCount = hands.length;
  const total = copies.reduce((sum, hand) => sum + hand.length, 0);
  let seat = ((dealerSeat + 1) % seatCount) as SeatId;
  for (let index = 0; index < total; index += 1) {
    const card = copies[seat]?.shift();
    if (card) {
      out.push(card);
    }
    seat = ((seat + 1) % seatCount) as SeatId;
  }
  return [...out, ...undealt];
}

const MAX_STRAIGHT = 6;

export function spiceDeck(input: {
  deck: Card[];
  dealerSeat: SeatId;
  seatCount: number;
  dealtCount: number;
  random: RandomSource;
  teamOf: number[];
  kind?: SpiceDealKind;
}): Card[] {
  const kind = input.kind ?? pickSpiceKind(input.random);
  let arranged = input.deck;
  if (kind !== 'fair') {
    const gifts = buildGifts(kind, input.deck, input.seatCount, input.teamOf, input.random);
    if (gifts && gifts.length > 0) {
      arranged =
        placeGifts(
          input.deck,
          gifts,
          input.dealerSeat,
          input.seatCount,
          input.dealtCount,
          input.random,
        ) ?? input.deck;
    }
  }
  const packed =
    input.dealtCount < input.deck.length
      ? dealLimited(
          arranged,
          input.dealerSeat,
          input.seatCount,
          input.dealtCount / input.seatCount,
        )
      : { hands: dealCards(arranged, input.dealerSeat, input.seatCount), undealt: [] as Card[] };
  return rebuildDeck(
    limitStraightLength(packed.hands, MAX_STRAIGHT, input.random),
    input.dealerSeat,
    packed.undealt,
  );
}
