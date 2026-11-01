import { occupantIdForSeat, occupantsOfSeats, pickBotReaction, ReactionService, type ReactionRoom } from '../src/reactions';

function reasonOf(result: ReturnType<ReactionService['submit']>) {
  return result.ok ? undefined : result.reason;
}

function room(over: Partial<ReactionRoom> = {}): ReactionRoom {
  return {
    id: 'game-1',
    status: 'playing',
    occupants: [
      { id: 'host', seat: 0 },
      { id: 'guest', seat: 1 },
      { id: 'bot:game-1:2', seat: 2 },
    ],
    ...over,
  };
}

describe('reaction catalog and occupant ids', () => {
  it('uses the human id and a stable bot id', () => {
    expect(occupantIdForSeat('g1', 0, 'host', false)).toBe('host');
    expect(occupantIdForSeat('g1', 2, null, true)).toBe('bot:g1:2');
    expect(occupantIdForSeat('g1', 3, null, false)).toBeNull();
    expect(occupantsOfSeats('g1', [
      { userId: 'host', isBot: false },
      { userId: null, isBot: true },
      { userId: null, isBot: false },
    ])).toEqual([
      { id: 'host', seat: 0 },
      { id: 'bot:g1:1', seat: 1 },
    ]);
  });
});

describe('ReactionService', () => {
  it('broadcasts a valid reaction to another player or bot and keeps no state', () => {
    const service = new ReactionService(() => 'evt-1');
    const table = room();
    const guest = service.submit({
      now: 1_000,
      room: table,
      senderId: 'host',
      requestId: 'req-guest-1',
      reactionId: 'heart',
      targetPlayerId: 'guest',
    });
    expect(guest.ok).toBe(true);
    if (guest.ok) {
      expect(guest.event.reactionId).toBe('heart');
      expect(guest.event.targetPlayerId).toBe('guest');
      expect(guest.event.targetSeat).toBe(1);
      expect(guest.event.senderPlayerId).toBe('host');
      expect(guest.event.senderSeat).toBe(0);
      expect(guest.event.eventId).toBe('evt-1');
    }
    const bot = service.submit({
      now: 1_001,
      room: table,
      senderId: 'host',
      requestId: 'req-bot-1',
      reactionId: 'kiss',
      targetPlayerId: 'bot:game-1:2',
    });
    expect(bot.ok).toBe(true);
    expect(table).toEqual(room());
  });

  it('rejects self-targets, invalid ids, missing members, and lobby state', () => {
    const service = new ReactionService(() => 'evt');
    expect(
      reasonOf(service.submit({
        now: 1,
        room: room(),
        senderId: 'host',
        requestId: 'req-self-1',
        reactionId: 'piggy',
        targetPlayerId: 'host',
      })),
    ).toBe('bad-target');
    expect(
      reasonOf(service.submit({
        now: 1,
        room: room({ status: 'lobby' }),
        senderId: 'host',
        requestId: 'req-lobby',
        reactionId: 'piggy',
        targetPlayerId: 'guest',
      })),
    ).toBe('not-playing');
    expect(
      reasonOf(service.submit({
        now: 1,
        room: room(),
        senderId: 'stranger',
        requestId: 'req-stranger',
        reactionId: 'piggy',
        targetPlayerId: 'guest',
      })),
    ).toBe('not-in-room');
    expect(
      reasonOf(service.submit({
        now: 1,
        room: room(),
        senderId: 'host',
        requestId: 'req-badid',
        reactionId: 'unicorn',
        targetPlayerId: 'guest',
      })),
    ).toBe('bad-reaction');
    expect(
      reasonOf(service.submit({
        now: 1,
        room: room(),
        senderId: 'host',
        requestId: 'req-gone1',
        reactionId: 'cool',
        targetPlayerId: 'left-already',
      })),
    ).toBe('bad-target');
  });
});

describe('bot reactions', () => {
  it('picks a bot sender and someone else as the target', () => {
    const pick = pickBotReaction(room().occupants, ['bot:game-1:2'], () => 0);
    expect(pick).not.toBeNull();
    expect(pick?.senderId).toBe('bot:game-1:2');
    expect(pick?.targetPlayerId).not.toBe('bot:game-1:2');
    expect(pick?.requestId.length).toBeGreaterThanOrEqual(6);
  });

  it('skips a table with no bots', () => {
    expect(pickBotReaction(room().occupants, [], () => 0)).toBeNull();
  });
});
