import { randomId } from '../platform/ids';
import { isReactionId, type ReactionId } from './catalog';

export type ReactionOccupant = { id: string; seat: number };

export type ReactionRoom = {
  id: string;
  status: 'lobby' | 'playing' | 'complete';
  occupants: ReactionOccupant[];
};

export type ReactionEvent = {
  eventId: string;
  roomId: string;
  senderPlayerId: string;
  senderSeat?: number;
  targetPlayerId: string;
  targetSeat?: number;
  reactionId: ReactionId;
  requestId: string;
  serverTimestamp: number;
};

export type ReactionReject = {
  reason: 'bad-reaction' | 'bad-target' | 'not-in-room' | 'not-playing' | 'bad-request';
  retryAfterMs?: number;
};

export function occupantIdForSeat(
  gameId: string,
  seatIndex: number,
  userId: string | null,
  isBot: boolean,
): string | null {
  if (userId) {
    return userId;
  }
  if (isBot) {
    return `bot:${gameId}:${seatIndex}`;
  }
  return null;
}

const REQUEST_ID = /^[A-Za-z0-9_-]{6,80}$/;

/** Validates and returns a one-shot display event. Nothing is stored. */
export class ReactionService {
  constructor(private readonly nextId: () => string = () => randomId('rx')) {}

  submit(input: {
    now: number;
    room: ReactionRoom;
    senderId: string;
    requestId: string;
    reactionId: string;
    targetPlayerId: string;
  }): { ok: true; event: ReactionEvent } | ({ ok: false } & ReactionReject) {
    if (input.room.status !== 'playing') {
      return { ok: false, reason: 'not-playing' };
    }
    const sender = input.room.occupants.find((row) => row.id === input.senderId);
    if (!sender) {
      return { ok: false, reason: 'not-in-room' };
    }
    if (!REQUEST_ID.test(input.requestId)) {
      return { ok: false, reason: 'bad-request' };
    }
    if (!isReactionId(input.reactionId)) {
      return { ok: false, reason: 'bad-reaction' };
    }
    const target = input.room.occupants.find((row) => row.id === input.targetPlayerId);
    if (!target || target.id === sender.id) {
      return { ok: false, reason: 'bad-target' };
    }
    return {
      ok: true,
      event: {
        eventId: this.nextId(),
        roomId: input.room.id,
        senderPlayerId: input.senderId,
        senderSeat: sender.seat,
        targetPlayerId: input.targetPlayerId,
        targetSeat: target.seat,
        reactionId: input.reactionId,
        requestId: input.requestId,
        serverTimestamp: input.now,
      },
    };
  }
}

export function occupantsOfSeats(
  gameId: string,
  seats: { userId: string | null; isBot: boolean }[],
): ReactionOccupant[] {
  return seats.flatMap((seat, index) => {
    const id = occupantIdForSeat(gameId, index, seat.userId, seat.isBot);
    return id ? [{ id, seat: index }] : [];
  });
}
