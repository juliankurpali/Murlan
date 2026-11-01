import { standardCardId } from '../cards/deck';
import { BLACK_JOKER_ID, Card, RED_JOKER_ID, STANDARD_RANKS, StandardCard, SUITS } from '../cards/types';
import { applyPass } from '../game/engine';
import { remainingFinishOrder } from '../game/scoring';
import { isFinished, nextUnfinishedSeat } from '../game/seats';
import { cloneHands } from '../game/deal';
import { GameState, isRuleError, SeatId, SEATS } from '../game/types';
import { abilityAt } from './assign';
import { abilityDefinition } from './registry';
import {
  AbilityActivation,
  ChaosAbilityId,
  ChaosNotice,
  ChaosNoticeAudience,
  ChaosState,
  PublicChaosView,
} from './types';

function notice(
  state: ChaosState,
  abilityId: ChaosAbilityId,
  sourceSeat: SeatId,
  key: string,
  audience: ChaosNoticeAudience,
  targetSeat?: SeatId,
): void {
  state.notices = [
    ...state.notices.slice(-11),
    {
      id: `n-${state.notices.length}-${sourceSeat}-${abilityId}`,
      abilityId,
      sourceSeat,
      targetSeat,
      audience,
      key,
      at: Date.now(),
    },
  ];
}

function consume(state: ChaosState, seat: SeatId): void {
  const row = state.abilities[seat];
  if (!row) {
    return;
  }
  const nextUses = Math.max(0, row.remainingUses - 1);
  state.abilities[seat] = {
    ...row,
    remainingUses: nextUses,
    consumed: nextUses === 0 || abilityDefinition(row.abilityId).activationType === 'active',
  };
}

function shieldBlocks(state: ChaosState, target: SeatId, source: SeatId, abilityId: ChaosAbilityId): boolean {
  if (!abilityDefinition(abilityId).hostile) {
    return false;
  }
  const shield = abilityAt(state, target);
  if (!shield || shield.abilityId !== 'shield' || shield.consumed) {
    return false;
  }
  state.abilities[target] = { ...shield, remainingUses: 0, consumed: true };
  notice(state, 'shield', source, 'chaosBlockedAttacker', 'source', target);
  notice(state, 'shield', target, 'chaosShieldUsed', 'target', source);
  notice(state, 'shield', source, 'chaosBlockedPublic', 'all', target);
  return true;
}

function assertLivingOpponent(match: GameState, source: SeatId, target: SeatId | undefined): SeatId {
  if (target === undefined || target === source || !SEATS.includes(target)) {
    throw new Error('chaos-bad-target');
  }
  if (isFinished(target, match.finishOrder) || match.hands[target].length === 0) {
    throw new Error('chaos-bad-target');
  }
  return target;
}


export function idsInPlay(match: GameState): Set<string> {
  const ids = new Set<string>();
  for (const seat of SEATS) {
    for (const card of match.hands[seat]) {
      ids.add(card.id);
    }
  }
  return ids;
}

export function wildOptions(match: GameState): Card[] {
  const used = idsInPlay(match);
  const out: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of STANDARD_RANKS) {
      const id = standardCardId(suit, rank);
      if (!used.has(id)) {
        out.push({ id, kind: 'standard', suit, rank });
      }
    }
  }
  return out;
}

export function giveBothJokers(match: GameState, seat: SeatId): GameState {
  const hands = cloneHands(match.hands);
  const want = [BLACK_JOKER_ID, RED_JOKER_ID];
  for (const id of want) {
    if (hands[seat].some((card) => card.id === id)) {
      continue;
    }
    let found: { from: SeatId; index: number } | null = null;
    for (const other of SEATS) {
      if (other === seat) {
        continue;
      }
      const index = hands[other].findIndex((card) => card.id === id);
      if (index >= 0) {
        found = { from: other, index };
        break;
      }
    }
    if (!found) {
      continue;
    }
    const swapIndex = hands[seat].findIndex((card) => !want.includes(card.id));
    if (swapIndex < 0) {
      continue;
    }
    const mine = hands[seat][swapIndex]!;
    const theirs = hands[found.from][found.index]!;
    hands[seat][swapIndex] = theirs;
    hands[found.from][found.index] = mine;
  }
  return { ...match, hands };
}

export function applyJokerKings(match: GameState, chaos: ChaosState): GameState {
  let next = match;
  for (const seat of SEATS) {
    if (chaos.abilities[seat]?.abilityId === 'jokerKing') {
      next = giveBothJokers(next, seat);
    }
  }
  return next;
}

export function expirePeeks(chaos: ChaosState, now = Date.now()): void {
  chaos.peeks = chaos.peeks.filter((peek) => peek.expiresAt > now);
}

export function markLastManStanding(match: GameState, chaos: ChaosState): void {
  if (match.phase !== 'matchComplete') {
    return;
  }
  const order = match.finishOrder.length >= 4 ? match.finishOrder : [...match.finishOrder, ...remainingFinishOrder(match)];
  const last = order[order.length - 1];
  if (last === undefined) {
    return;
  }
  if (chaos.abilities[last]?.abilityId === 'lastManStanding') {
    chaos.specialVictorySeat = last;
    notice(chaos, 'lastManStanding', last, 'chaosLastManWin', 'all');
  }
}

export function publicChaosView(match: GameState, chaos: ChaosState, viewer: SeatId, now = Date.now()): PublicChaosView {
  expirePeeks(chaos, now);
  const own = chaos.abilities[viewer];
  const definition = own ? abilityDefinition(own.abilityId) : null;
  const peek = chaos.peeks.find((row) => row.viewer === viewer && row.expiresAt > now) ?? null;
  const notices = chaos.notices.filter((row) => {
    if (row.audience === 'all') {
      return true;
    }
    if (row.audience === 'source') {
      return row.sourceSeat === viewer;
    }
    if (row.audience === 'target') {
      return row.targetSeat === viewer;
    }
    return row.sourceSeat === viewer || row.targetSeat === viewer;
  });
  return {
    active: true,
    own: own && definition
      ? {
          abilityId: own.abilityId,
          activationType: definition.activationType,
          remainingUses: own.remainingUses,
          consumed: own.consumed,
          targeting: definition.targeting,
        }
      : null,
    revealedHand: peek
      ? { seat: peek.target, cards: match.hands[peek.target].slice(), expiresAt: peek.expiresAt }
      : null,
    notices: notices.slice(-4),
    specialVictorySeat: chaos.specialVictorySeat,
    wildOptions: own?.abilityId === 'wildCard' && !own.consumed ? wildOptions(match) : [],
    frozenSeats: chaos.freezeNext.slice(),
  };
}

export function activateAbility(
  match: GameState,
  chaos: ChaosState,
  seat: SeatId,
  activation: AbilityActivation,
  now = Date.now(),
): GameState {
  if (match.phase === 'matchComplete') {
    throw new Error('matchComplete');
  }
  const row = chaos.abilities[seat];
  if (!row || row.abilityId !== activation.abilityId) {
    throw new Error('chaos-no-ability');
  }
  const definition = abilityDefinition(row.abilityId);
  if (definition.activationType !== 'active' || row.consumed || row.remainingUses <= 0) {
    throw new Error('chaos-used');
  }
  if (match.phase !== 'playing' && row.abilityId !== 'mindReader') {
    throw new Error('wrongPhase');
  }

  if (definition.targeting === 'opponent') {
    const target = assertLivingOpponent(match, seat, activation.targetSeat);
    if (shieldBlocks(chaos, target, seat, row.abilityId)) {
      consume(chaos, seat);
      return match;
    }
    if (row.abilityId === 'mindReader') {
      chaos.peeks.push({ viewer: seat, target, expiresAt: now + 5_000 });
      notice(chaos, 'mindReader', seat, 'chaosMindReaderPublic', 'all', target);
      notice(chaos, 'mindReader', seat, 'chaosMindReaderYou', 'source', target);
      consume(chaos, seat);
      return match;
    }
    if (row.abilityId === 'freeze') {
      if (!chaos.freezeNext.includes(target)) {
        chaos.freezeNext = [...chaos.freezeNext, target];
      }
      notice(chaos, 'freeze', seat, 'chaosFrozenPublic', 'all', target);
      notice(chaos, 'freeze', seat, 'chaosFrozenTarget', 'target', target);
      consume(chaos, seat);
      return match;
    }
    if (row.abilityId === 'cardThief') {
      const mine = match.hands[seat];
      const theirs = match.hands[target];
      if (mine.length === 0 || theirs.length === 0) {
        throw new Error('chaos-bad-target');
      }
      const hands = cloneHands(match.hands);
      const myIndex = Math.floor(Math.random() * mine.length);
      const theirIndex = Math.floor(Math.random() * theirs.length);
      const a = hands[seat][myIndex]!;
      const b = hands[target][theirIndex]!;
      hands[seat][myIndex] = b;
      hands[target][theirIndex] = a;
      notice(chaos, 'cardThief', seat, 'chaosStolenPublic', 'all', target);
      notice(chaos, 'cardThief', seat, 'chaosStolenYou', 'pair', target);
      consume(chaos, seat);
      return { ...match, hands };
    }
  }

  if (row.abilityId === 'wildCard') {
    const source = match.hands[seat].find((card) => card.id === activation.cardId);
    const intoId = activation.intoCardId;
    if (!source || source.kind !== 'standard' || !intoId) {
      throw new Error('chaos-bad-card');
    }
    const option = wildOptions(match).find((card) => card.id === intoId);
    if (!option || option.kind !== 'standard') {
      throw new Error('chaos-bad-card');
    }
    const replacement: StandardCard = {
      id: option.id,
      kind: 'standard',
      suit: option.suit,
      rank: option.rank,
    };
    const hands = cloneHands(match.hands);
    hands[seat] = hands[seat].map((card) => (card.id === source.id ? replacement : card));
    chaos.wildSeq += 1;
    notice(chaos, 'wildCard', seat, 'chaosWildPublic', 'all');
    consume(chaos, seat);
    return { ...match, hands };
  }

  throw new Error('chaos-no-ability');
}

export function nextNoticeKey(notices: ChaosNotice[], viewer: SeatId): string | null {
  const visible = notices.filter((row) => {
    if (row.audience === 'all') {
      return true;
    }
    if (row.audience === 'source') {
      return row.sourceSeat === viewer;
    }
    if (row.audience === 'target') {
      return row.targetSeat === viewer;
    }
    return row.sourceSeat === viewer || row.targetSeat === viewer;
  });
  return visible[visible.length - 1]?.key ?? null;
}

export function announceExtraTurn(chaos: ChaosState, seat: SeatId): void {
  notice(chaos, 'secondChance', seat, 'chaosSecondChanceNow', 'all');
}

export function skipFrozenTurn(match: GameState, chaos: ChaosState): GameState {
  if (match.phase !== 'playing') {
    return match;
  }
  const seat = match.currentSeat;
  if (!chaos.freezeNext.includes(seat)) {
    return match;
  }
  chaos.freezeNext = chaos.freezeNext.filter((row) => row !== seat);
  notice(chaos, 'freeze', seat, 'chaosFrozenSkippedPublic', 'all');
  notice(chaos, 'freeze', seat, 'chaosFrozenSkipped', 'target');
  if (!match.trick.combination) {
    const next = nextUnfinishedSeat(seat, match.finishOrder);
    if (next === null) {
      return match;
    }
    return {
      ...match,
      currentSeat: next,
      trick: {
        leaderSeat: next,
        combination: null,
        lastSuccessfulSeat: null,
        passedSinceLastPlay: [],
      },
    };
  }
  const passed = applyPass(match, seat);
  if (isRuleError(passed)) {
    const next = nextUnfinishedSeat(seat, match.finishOrder);
    return next === null ? match : { ...match, currentSeat: next };
  }
  return passed;
}

export function resolveFrozenTurns(match: GameState, chaos: ChaosState): GameState {
  let next = match;
  for (let i = 0; i < 4; i += 1) {
    if (next.phase !== 'playing' || !chaos.freezeNext.includes(next.currentSeat)) {
      return next;
    }
    const skipped = skipFrozenTurn(next, chaos);
    if (skipped === next) {
      return next;
    }
    next = skipped;
  }
  return next;
}

export function announcePassives(chaos: ChaosState): void {
  for (const seat of SEATS) {
    const row = chaos.abilities[seat];
    if (row?.abilityId === 'lastManStanding') {
      notice(chaos, 'lastManStanding', seat, 'chaosLastManYou', 'source');
    }
    if (row?.abilityId === 'jokerKing') {
      notice(chaos, 'jokerKing', seat, 'chaosJokerKingYou', 'source');
    }
    if (row?.abilityId === 'secondChance') {
      notice(chaos, 'secondChance', seat, 'chaosSecondChanceYou', 'source');
    }
    if (row?.abilityId === 'shield') {
      notice(chaos, 'shield', seat, 'chaosShieldYou', 'source');
    }
  }
}

export function createEmptyChaos(): ChaosState {
  return {
    abilities: [null, null, null, null],
    freezeNext: [],
    peeks: [],
    specialVictorySeat: null,
    notices: [],
    wildSeq: 0,
  };
}
