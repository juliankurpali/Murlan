import { createRoomCode, fillBots, guestsAreReady, hostRoom, isRoomCode, joinRoom, roomIsReady, tableSeat } from '../src/online/room';

describe('online rooms', () => {
  it('creates a four-character host code from the safe alphabet', () => {
    const room = hostRoom('You');
    expect(room.host).toBe(true);
    expect(room.mode).toBe('2v2');
    expect(room.seats).toHaveLength(4);
    expect(room.seats[0]?.isYou).toBe(true);
    expect(isRoomCode(room.code)).toBe(true);
    expect(roomIsReady(room)).toBe(false);
  });

  it('rejects confusing room codes', () => {
    expect(isRoomCode('A7K2')).toBe(true);
    expect(isRoomCode('a7k2')).toBe(true);
    expect(isRoomCode('I0O1')).toBe(false);
    expect(isRoomCode('ABC')).toBe(false);
  });

  it('fills empty seats with bots so the table can start', () => {
    const hosted = hostRoom('You');
    const filled = fillBots(hosted, ['Leka', 'Drita', 'Gjergj']);
    expect(roomIsReady(filled)).toBe(true);
    expect(guestsAreReady(filled)).toBe(true);
    expect(filled.seats.filter((seat) => seat.isBot)).toHaveLength(3);
    expect(filled.seats.filter((seat) => seat.isBot).map((seat) => seat.name)).toEqual([
      'Leka (AI)',
      'Drita (AI)',
      'Gjergj (AI)',
    ]);
  });

  it('waits for invited players to ready up', () => {
    const room = joinRoom('A7K2', 'Guest');
    expect(guestsAreReady(room)).toBe(false);
    const ready = {
      ...room,
      seats: room.seats.map((seat) => (seat.isYou ? { ...seat, lobbyReady: true } : seat)),
    };
    expect(guestsAreReady(ready)).toBe(true);
  });

  it('joins a room as the second seat', () => {
    const code = createRoomCode();
    const room = joinRoom(code, 'Guest');
    expect(room.host).toBe(false);
    expect(room.code).toBe(code);
    expect(room.seats[1]?.isYou).toBe(true);
    expect(room.seats[1]?.name).toBe('Guest');
  });

  it('rotates the table so the local player sits south', () => {
    expect(tableSeat(2, 'south')).toBe(2);
    expect(tableSeat(2, 'west')).toBe(3);
    expect(tableSeat(2, 'north')).toBe(0);
    expect(tableSeat(2, 'east')).toBe(1);
  });
});
