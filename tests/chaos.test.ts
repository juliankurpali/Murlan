import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyJokerKings,
  applyPlay,
  assignAbilities,
  ChaosState,
  createSeededRandom,
  markLastManStanding,
  SEATS,
} from '../src/domain';
import { BLACK_JOKER_ID, RED_JOKER_ID } from '../src/domain/cards/types';
import { applyUserIntent, payloadFor, startMatch } from '../src/platform/match';
import { PlatformStore } from '../src/platform/store';
import { C, createPlayingState } from './helpers';

function tempStore(): PlatformStore {
  return new PlatformStore(join(mkdtempSync(join(tmpdir(), 'murlan-chaos-')), 'platform.json'));
}

function seatedChaos() {
  const store = tempStore();
  const host = store.auth(store.guest('hosthost').token)!;
  const guest = store.auth(store.guest('guestgst').token)!;
  const game = store.createGame(host);
  store.joinGame(guest, game.code);
  store.setMatchMode(host, game, 'chaos');
  store.fillBots(game, ['Leka', 'Drita']);
  startMatch(game);
  return { store, host, guest, game };
}

describe('chaos abilities', () => {
  it('assigns unique weighted abilities without replacement', () => {
    const first = assignAbilities(createSeededRandom(7));
    const ids = SEATS.map((seat) => first.abilities[seat]?.abilityId).filter(Boolean);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);

    const forced = assignAbilities(createSeededRandom(3), SEATS, {
      weights: {
        mindReader: 1,
        freeze: 1,
        cardThief: 1,
        shield: 1,
        secondChance: 0,
        jokerKing: 0,
        wildCard: 0,
        lastManStanding: 0,
      },
    });
    const forcedIds = SEATS.map((seat) => forced.abilities[seat]?.abilityId);
    expect(forcedIds.sort()).toEqual(['cardThief', 'freeze', 'mindReader', 'shield']);
  });

  it('leaves Classic Mode without chaos state', () => {
    const store = tempStore();
    const host = store.auth(store.guest('hosthost').token)!;
    const game = store.createGame(host);
    store.fillBots(game, ['Leka', 'Drita', 'Gjergj']);
    startMatch(game);
    expect(game.mode).toBe('2v2');
    expect(game.chaos).toBeNull();
    expect(payloadFor(game, host.id)?.chaos ?? null).toBeNull();
  });

  it('assigns one private ability per player in Chaos Mode', () => {
    const { host, guest, game } = seatedChaos();
    expect(game.mode).toBe('chaos');
    expect(game.chaos).toBeTruthy();
    const hostView = payloadFor(game, host.id)!;
    const guestView = payloadFor(game, guest.id)!;
    expect(hostView.chaos?.own?.abilityId).toBeTruthy();
    expect(guestView.chaos?.own?.abilityId).toBeTruthy();
    expect(hostView.chaos?.own?.abilityId).not.toBe(guestView.chaos?.own?.abilityId);
    expect(JSON.stringify(hostView.chaos)).not.toContain(guestView.chaos?.own?.abilityId);
  });

  it('reveals Mind Reader cards only to the activating player', () => {
    const { host, guest, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    const guestSeat = game.seats.findIndex((seat) => seat.userId === guest.id) as 0 | 1 | 2 | 3;
    game.chaos!.abilities[hostSeat] = {
      seat: hostSeat,
      abilityId: 'mindReader',
      remainingUses: 1,
      consumed: false,
    };
    game.chaos!.abilities[guestSeat] = {
      seat: guestSeat,
      abilityId: 'lastManStanding',
      remainingUses: 0,
      consumed: false,
    };
    applyUserIntent(game, host.id, { kind: 'ability', abilityId: 'mindReader', targetSeat: guestSeat });
    const hostView = payloadFor(game, host.id)!;
    const guestView = payloadFor(game, guest.id)!;
    expect(hostView.chaos?.revealedHand?.seat).toBe(guestSeat);
    expect(hostView.chaos?.revealedHand?.cards.map((card) => card.id)).toEqual(
      game.match!.hands[guestSeat].map((card) => card.id),
    );
    expect(guestView.chaos?.revealedHand).toBeNull();
    expect(JSON.stringify(guestView.chaos)).not.toContain('"revealedHand":{');
  });

  it('lets Shield block Freeze and consumes both', () => {
    const { host, guest, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    const guestSeat = game.seats.findIndex((seat) => seat.userId === guest.id) as 0 | 1 | 2 | 3;
    game.chaos!.abilities[hostSeat] = {
      seat: hostSeat,
      abilityId: 'freeze',
      remainingUses: 1,
      consumed: false,
    };
    game.chaos!.abilities[guestSeat] = {
      seat: guestSeat,
      abilityId: 'shield',
      remainingUses: 1,
      consumed: false,
    };
    applyUserIntent(game, host.id, { kind: 'ability', abilityId: 'freeze', targetSeat: guestSeat });
    expect(game.chaos!.freezeNext).toEqual([]);
    expect(game.chaos!.abilities[hostSeat]?.consumed).toBe(true);
    expect(game.chaos!.abilities[guestSeat]?.consumed).toBe(true);
    const hostView = payloadFor(game, host.id)!;
    expect(hostView.chaos?.notices.some((row) => row.key === 'chaosBlockedAttacker')).toBe(true);
  });

  it('skips a frozen player with existing turn rules', () => {
    const { host, guest, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    const guestSeat = game.seats.findIndex((seat) => seat.userId === guest.id) as 0 | 1 | 2 | 3;
    game.chaos!.abilities[hostSeat] = {
      seat: hostSeat,
      abilityId: 'freeze',
      remainingUses: 1,
      consumed: false,
    };
    game.chaos!.abilities[guestSeat] = {
      seat: guestSeat,
      abilityId: 'lastManStanding',
      remainingUses: 0,
      consumed: false,
    };
    game.match = {
      ...game.match!,
      currentSeat: guestSeat,
      trick: {
        leaderSeat: guestSeat,
        combination: null,
        lastSuccessfulSeat: null,
        passedSinceLastPlay: [],
      },
    };
    applyUserIntent(game, host.id, { kind: 'ability', abilityId: 'freeze', targetSeat: guestSeat });
    expect(game.chaos!.freezeNext.includes(guestSeat)).toBe(false);
    expect(game.match.currentSeat).not.toBe(guestSeat);
  });

  it('awards Last Man Standing when that player finishes last', () => {
    const { host, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    const last = ((hostSeat + 1) % 4) as 0 | 1 | 2 | 3;
    game.chaos!.abilities[last] = {
      seat: last,
      abilityId: 'lastManStanding',
      remainingUses: 0,
      consumed: false,
    };
    game.match = {
      ...game.match!,
      phase: 'matchComplete',
      finishOrder: [hostSeat, ((hostSeat + 2) % 4) as 0 | 1 | 2 | 3, ((hostSeat + 3) % 4) as 0 | 1 | 2 | 3, last],
      winner: 'team0',
    };
    markLastManStanding(game.match, game.chaos!);
    expect(game.chaos!.specialVictorySeat).toBe(last);
    const view = payloadFor(game, host.id)!;
    expect(view.chaos?.specialVictorySeat).toBe(last);
  });

  it('exchanges one random card for Card Thief', () => {
    const { host, guest, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    const guestSeat = game.seats.findIndex((seat) => seat.userId === guest.id) as 0 | 1 | 2 | 3;
    const beforeHost = game.match!.hands[hostSeat].map((card) => card.id).sort();
    const beforeGuest = game.match!.hands[guestSeat].map((card) => card.id).sort();
    game.chaos!.abilities[hostSeat] = {
      seat: hostSeat,
      abilityId: 'cardThief',
      remainingUses: 1,
      consumed: false,
    };
    game.chaos!.abilities[guestSeat] = {
      seat: guestSeat,
      abilityId: 'lastManStanding',
      remainingUses: 0,
      consumed: false,
    };
    applyUserIntent(game, host.id, { kind: 'ability', abilityId: 'cardThief', targetSeat: guestSeat });
    const afterHost = game.match!.hands[hostSeat].map((card) => card.id).sort();
    const afterGuest = game.match!.hands[guestSeat].map((card) => card.id).sort();
    expect(afterHost).toHaveLength(beforeHost.length);
    expect(afterGuest).toHaveLength(beforeGuest.length);
    expect(afterHost.join()).not.toBe(beforeHost.join());
    expect(afterGuest.join()).not.toBe(beforeGuest.join());
    expect(new Set([...afterHost, ...afterGuest])).toEqual(new Set([...beforeHost, ...beforeGuest]));
  });

  it('gives Joker King both jokers after the deal', () => {
    const { host, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    game.chaos!.abilities = [0, 1, 2, 3].map((seat) =>
      seat === hostSeat
        ? { seat: hostSeat, abilityId: 'jokerKing' as const, remainingUses: 0, consumed: false }
        : { seat: seat as 0 | 1 | 2 | 3, abilityId: 'shield' as const, remainingUses: 0, consumed: true },
    ) as ChaosState['abilities'];
    game.match = applyJokerKings(game.match!, game.chaos!);
    const ids = game.match.hands[hostSeat].map((card) => card.id);
    expect(ids).toContain(BLACK_JOKER_ID);
    expect(ids).toContain(RED_JOKER_ID);
  });

  it('transforms a Wild Card into an unused identity', () => {
    const { host, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    const otherSeat = ((hostSeat + 1) % 4) as 0 | 1 | 2 | 3;
    const source = game.match!.hands[hostSeat].find((card) => card.kind === 'standard')!;
    const otherHand = game.match!.hands[otherSeat];
    const freeIndex = otherHand.findIndex((card) => card.kind === 'standard');
    const freed = otherHand.splice(freeIndex, 1)[0]!;
    game.chaos!.abilities[hostSeat] = {
      seat: hostSeat,
      abilityId: 'wildCard',
      remainingUses: 1,
      consumed: false,
    };
    const option =
      payloadFor(game, host.id)!.chaos!.wildOptions.find((card) => card.id === freed.id) ??
      payloadFor(game, host.id)!.chaos!.wildOptions[0]!;
    applyUserIntent(game, host.id, {
      kind: 'ability',
      abilityId: 'wildCard',
      cardId: source.id,
      intoCardId: option.id,
    });
    expect(game.match!.hands[hostSeat].some((card) => card.id === option.id)).toBe(true);
    expect(game.match!.hands[hostSeat].some((card) => card.id === source.id)).toBe(false);
    const all = game.match!.hands.flatMap((hand) => hand.map((card) => card.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('shows public ability events to every player, with source and target seats', () => {
    const { host, guest, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    const botSeat = game.seats.findIndex((seat) => seat.isBot) as 0 | 1 | 2 | 3;
    game.chaos!.abilities[hostSeat] = {
      seat: hostSeat,
      abilityId: 'freeze',
      remainingUses: 1,
      consumed: false,
    };
    game.chaos!.abilities[botSeat] = {
      seat: botSeat,
      abilityId: 'jokerKing',
      remainingUses: 0,
      consumed: true,
    };
    applyUserIntent(game, host.id, { kind: 'ability', abilityId: 'freeze', targetSeat: botSeat });
    const guestView = payloadFor(game, guest.id)!;
    const row = guestView.chaos?.notices.find((notice) => notice.key === 'chaosFrozenPublic');
    expect(row?.audience).toBe('all');
    expect(row?.sourceSeat).toBe(hostSeat);
    expect(row?.targetSeat).toBe(botSeat);
    expect(row?.abilityId).toBe('freeze');
  });

  it('rejects a spoofed ability id and a second activation', () => {
    const { host, guest, game } = seatedChaos();
    const hostSeat = game.seats.findIndex((seat) => seat.userId === host.id) as 0 | 1 | 2 | 3;
    const guestSeat = game.seats.findIndex((seat) => seat.userId === guest.id) as 0 | 1 | 2 | 3;
    game.chaos!.abilities[hostSeat] = {
      seat: hostSeat,
      abilityId: 'mindReader',
      remainingUses: 1,
      consumed: false,
    };
    expect(() =>
      applyUserIntent(game, host.id, { kind: 'ability', abilityId: 'freeze', targetSeat: guestSeat }),
    ).toThrow('chaos-no-ability');
    applyUserIntent(game, host.id, { kind: 'ability', abilityId: 'mindReader', targetSeat: guestSeat });
    expect(() =>
      applyUserIntent(game, host.id, { kind: 'ability', abilityId: 'mindReader', targetSeat: guestSeat }),
    ).toThrow('chaos-used');
  });

  it('gives Second Chance one extra turn before last place locks', () => {
    const state = createPlayingState({
      extraTurnSeat: 3,
      extraTurnUsed: false,
      finishOrder: [0, 1],
      currentSeat: 2,
      hands: [C('S3'), C('H4'), C('D5', 'H5'), C('C7', 'C8')],
    });
    const next = applyPlay(state, 2, C('D5', 'H5'));
    if ('type' in next) {
      throw new Error(next.message);
    }
    expect(next.phase).toBe('playing');
    expect(next.extraTurnUsed).toBe(true);
    expect(next.currentSeat).toBe(3);
    expect(next.finishOrder).toEqual([0, 1, 2]);
  });
});
