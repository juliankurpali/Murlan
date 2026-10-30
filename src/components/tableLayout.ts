import { SeatId } from '../domain';

export type TableSize = { width: number; height: number };
export type Point = { x: number; y: number };

export const FLIGHT_CARD = { width: 50, height: 72 };
export const FLIGHT_CARD_PHONE = { width: 48, height: 70 };

export const HAND_CARD_MAX = { width: 72, height: 104 };
export const HAND_CARD_PHONE = { width: 52, height: 74 };
const HAND_PAD_X = 8;
const VISIBLE_RATIO = 0.65;

export function isPhoneViewport(width: number, height: number): boolean {
  return Math.min(width, height) < 500;
}

export function handCardMax(width: number, height: number): { width: number; height: number } {
  return isPhoneViewport(width, height) ? HAND_CARD_PHONE : HAND_CARD_MAX;
}

export type HandFit = {
  width: number;
  height: number;
  overlap: number;
  lift: number;
};

export function fitHandCards(
  count: number,
  _availableWidth: number,
  max: { width: number; height: number } = HAND_CARD_MAX,
): HandFit {
  const lift = Math.max(8, Math.round(max.height * 0.14));
  if (count <= 1) {
    return { ...max, overlap: 0, lift };
  }
  const overlap = Math.round(max.width * (1 - VISIBLE_RATIO));
  return { width: max.width, height: max.height, overlap, lift };
}

export function handSideInset(tableWidth: number): number {
  if (tableWidth < 520) {
    return 16;
  }
  return 24;
}

export function tableCenter(size: TableSize): Point {
  return { x: size.width / 2, y: size.height / 2 };
}

export function seatPoint(seat: SeatId, size: TableSize): Point {
  const padX = Math.max(28, size.width * 0.08);
  const padY = Math.max(24, size.height * 0.1);
  switch (seat) {
    case 0:
      return { x: size.width / 2, y: size.height - padY };
    case 1:
      return { x: padX, y: size.height / 2 };
    case 2:
      return { x: size.width / 2, y: padY };
    case 3:
      return { x: size.width - padX, y: size.height / 2 };
    default:
      return tableCenter(size);
  }
}

/** Map a logical seat onto the table as seen from `localSeat` (you are always south). */
export function visualOffset(seat: SeatId, localSeat: SeatId): SeatId {
  return ((((seat - localSeat) % 4) + 4) % 4) as SeatId;
}

export function visualSeatPoint(seat: SeatId, localSeat: SeatId, size: TableSize): Point {
  return seatPoint(visualOffset(seat, localSeat), size);
}

export function opponentFanFit(
  count: number,
  maxWidth: number,
  cardWidth: number,
): { overlap: number; tiltStep: number } {
  if (count <= 1) {
    return { overlap: 0, tiltStep: 0 };
  }
  const needed = Math.max(4, (maxWidth - cardWidth) / (count - 1));
  const stride = Math.min(cardWidth * 0.5, needed);
  return {
    overlap: cardWidth - stride,
    tiltStep: Math.min(5, 32 / (count - 1)),
  };
}

export function fanSpread(index: number, count: number): { x: number; y: number; rotate: number } {
  const mid = (count - 1) / 2;
  const offset = index - mid;
  return {
    x: offset * 20,
    y: Math.abs(offset) * 3,
    rotate: offset * 5,
  };
}
