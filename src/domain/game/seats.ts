import { GameState, SeatId } from './types';

export function seatCountOf(state: Pick<GameState, 'hands'>): number {
  return state.hands.length;
}

export function seatsOf(state: Pick<GameState, 'hands'>): SeatId[] {
  return state.hands.map((_, index) => index as SeatId);
}

export function nextSeat(seat: SeatId, count = 4): SeatId {
  return ((seat + 1) % count) as SeatId;
}

export function isFinished(seat: SeatId, finishOrder: SeatId[]): boolean {
  return finishOrder.includes(seat);
}

export function unfinishedSeats(finishOrder: SeatId[], count = 4): SeatId[] {
  const seats = Array.from({ length: count }, (_, index) => index as SeatId);
  return seats.filter((seat) => !finishOrder.includes(seat));
}

export function placeForSeat(seat: SeatId, finishOrder: SeatId[], count = 4): number | null {
  const index = finishOrder.indexOf(seat);
  if (index >= 0) {
    return index + 1;
  }
  if (finishOrder.length >= count - 1) {
    const leftover = unfinishedSeats(finishOrder, count);
    const extra = leftover.indexOf(seat);
    if (extra >= 0) {
      return finishOrder.length + extra + 1;
    }
  }
  return null;
}

export function nextUnfinishedSeat(from: SeatId, finishOrder: SeatId[], count = 4): SeatId | null {
  let seat = from;
  for (let i = 0; i < count; i += 1) {
    seat = nextSeat(seat, count);
    if (!finishOrder.includes(seat)) {
      return seat;
    }
  }
  return null;
}

export function clockwiseFrom(start: SeatId, count = 4): SeatId[] {
  return Array.from({ length: count }, (_, offset) => ((start + offset) % count) as SeatId);
}
