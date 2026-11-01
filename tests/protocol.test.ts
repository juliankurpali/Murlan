import { sanitizeChat } from '../src/online/chat';
import { toGameRoom } from '../src/online/protocol';

describe('relay room mapping', () => {
  it('marks the local player with isYou', () => {
    const room = toGameRoom(
      {
        code: 'A7K2',
        hostId: 'host',
        started: false,
        seats: [
          {
            name: 'Host',
            ready: true,
            isBot: false,
            muted: true,
            speaking: false,
            voiceAvailable: true,
            connection: 'connected',
            playerId: 'host',
          },
          {
            name: 'P2',
            ready: true,
            isBot: false,
            muted: false,
            speaking: true,
            voiceAvailable: true,
            connection: 'connected',
            playerId: 'guest',
          },
          null,
          null,
        ],
      },
      'guest',
    );
    expect(room.mode).toBe('2v2');
    expect(room.host).toBe(false);
    expect(room.seats[0]?.isYou).toBe(false);
    expect(room.seats[1]?.isYou).toBe(true);
    expect(room.seats[1]?.playerId).toBe('guest');
    expect(room.seats[1]?.speaking).toBe(true);
    expect(room.seats[2]?.ready).toBe(false);
  });

  it('keeps Not ready when a seated player turns lobbyReady off', () => {
    const room = toGameRoom(
      {
        code: 'A7K2',
        hostId: 'host',
        started: false,
        seats: [
          {
            name: 'Host',
            ready: true,
            lobbyReady: false,
            isBot: false,
            muted: true,
            speaking: false,
            voiceAvailable: true,
            connection: 'connected',
            playerId: 'host',
          },
          {
            name: 'P2',
            ready: true,
            lobbyReady: false,
            isBot: false,
            muted: true,
            speaking: false,
            voiceAvailable: true,
            connection: 'connected',
            playerId: 'guest',
          },
          null,
          null,
        ],
      },
      'guest',
    );
    expect(room.seats[0]?.lobbyReady).toBe(true);
    expect(room.seats[1]?.lobbyReady).toBe(false);
    expect(room.seats[1]?.isYou).toBe(true);
  });

  it('trims and caps table chat', () => {
    expect(sanitizeChat('  hello   table  ')).toBe('hello table');
    expect(sanitizeChat('x'.repeat(200)).length).toBe(140);
    expect(sanitizeChat('   ')).toBe('');
  });
});
