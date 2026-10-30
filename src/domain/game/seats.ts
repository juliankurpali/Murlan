import { SeatId, SEATS } from './types';

export function nextSeat(seat: SeatId): SeatId {
  return ((seat + 1) % 4) as SeatId;
}

export function isFinished(seat: SeatId, finishOrder: SeatId[]): boolean {
  return finishOrder.includes(seat);
}

export function unfinishedSeats(finishOrder: SeatId[]): SeatId[] {
  return SEATS.filter((seat) => !finishOrder.includes(seat));
}

export function placeForSeat(seat: SeatId, finishOrder: SeatId[]): number | null {
  const index = finishOrder.indexOf(seat);
  if (index >= 0) {
    return index + 1;
  }
  if (finishOrder.length >= 3) {
    const leftover = unfinishedSeats(finishOrder);
    const extra = leftover.indexOf(seat);
    if (extra >= 0) {
      return finishOrder.length + extra + 1;
    }
  }
  return null;
}

export function nextUnfinishedSeat(from: SeatId, finishOrder: SeatId[]): SeatId | null {
  let seat = from;
  for (let i = 0; i < 4; i += 1) {
    seat = nextSeat(seat);
    if (!finishOrder.includes(seat)) {
      return seat;
    }
  }
  return null;
}

export function clockwiseFrom(start: SeatId): SeatId[] {
  return [0, 1, 2, 3].map((offset) => ((start + offset) % 4) as SeatId);
}
