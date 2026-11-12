import { SeatId } from '../domain';

export type TableSize = { width: number; height: number };
export type Point = { x: number; y: number };

export const FLIGHT_CARD = { width: 50, height: 72 };
export const FLIGHT_CARD_PHONE = { width: 48, height: 70 };

export const HAND_CARD_MAX = { width: 56, height: 80 };
export const HAND_CARD_PHONE = { width: 42, height: 60 };
const HAND_PAD_X = 8;
const VISIBLE_RATIO = 0.65;

export function isPhoneViewport(width: number, height: number): boolean {
  return Math.min(width, height) < 500;
}

export const HAND_SCALE_STEPS = [0.72, 0.86, 1, 1.16, 1.34] as const;

export function handCardMax(width: number, height: number): { width: number; height: number } {
  return isPhoneViewport(width, height) ? HAND_CARD_PHONE : HAND_CARD_MAX;
}

export function scaledHandCard(
  base: { width: number; height: number },
  size: number,
): { width: number; height: number } {
  const index = Math.max(0, Math.min(HAND_SCALE_STEPS.length - 1, Math.round(size)));
  const scale = HAND_SCALE_STEPS[index] ?? 1;
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
  };
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
  const lift = Math.max(6, Math.round(max.height * 0.1));
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

export function tableCenterLift(height: number): number {
  return Math.max(22, Math.round(height * 0.08));
}

export function tableCenter(size: TableSize): Point {
  return { x: size.width / 2, y: size.height / 2 - tableCenterLift(size.height) };
}

/** Screen radians: 0 = east, π/2 = south. South is always visual seat 0. */
const FOUR_SEAT_ANGLES = [Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 0];
const SIX_SEAT_ANGLES = [
  Math.PI / 2,
  0.9 * Math.PI,
  1.24 * Math.PI,
  1.5 * Math.PI,
  1.76 * Math.PI,
  0.1 * Math.PI,
];

function anglesForCount(seatCount: number): number[] {
  // Keep Classic / Super oval seats — do not evenly-space 3/5 into odd angles.
  if (seatCount >= 6) return SIX_SEAT_ANGLES;
  if (seatCount === 5) {
    // Super oval without due-north: south, SW, NW, NE, SE.
    return [
      SIX_SEAT_ANGLES[0]!,
      SIX_SEAT_ANGLES[1]!,
      SIX_SEAT_ANGLES[2]!,
      SIX_SEAT_ANGLES[4]!,
      SIX_SEAT_ANGLES[5]!,
    ];
  }
  if (seatCount === 3) {
    // Classic left / right seats (west + east), you stay south.
    return [FOUR_SEAT_ANGLES[0]!, FOUR_SEAT_ANGLES[1]!, FOUR_SEAT_ANGLES[3]!];
  }
  return FOUR_SEAT_ANGLES;
}

export function seatAngle(visualSeat: number, seatCount = 4): number {
  const table = anglesForCount(seatCount);
  return table[((visualSeat % table.length) + table.length) % table.length] ?? Math.PI / 2;
}

export function seatPoint(seat: SeatId, size: TableSize, seatCount = 4): Point {
  const angle = seatAngle(seat, seatCount);
  const insetX = Math.max(34, size.width * 0.055);
  const insetY = Math.max(26, size.height * 0.09);
  const rx = Math.max(64, size.width / 2 - insetX);
  const ry = Math.max(48, size.height / 2 - insetY);
  const north = Math.floor(seatCount / 2);
  return {
    x: size.width / 2 + rx * Math.cos(angle),
    y: size.height / 2 + ry * Math.sin(angle) + (seat === north ? Math.min(20, size.height * 0.05) : 0),
  };
}

/** Map a logical seat onto the table as seen from `localSeat` (you are always south). */
export function visualOffset(seat: SeatId, localSeat: SeatId, seatCount = 4): SeatId {
  const count = seatCount || 4;
  return ((((seat - localSeat) % count) + count) % count) as SeatId;
}

export function visualSeatPoint(seat: SeatId, localSeat: SeatId, size: TableSize, seatCount = 4): Point {
  return seatPoint(visualOffset(seat, localSeat, seatCount), size, seatCount);
}

/** Where a played card leaves from: your hand, or the seat that player occupies. */
export function playOriginPoint(
  seat: SeatId,
  localSeat: SeatId,
  size: TableSize,
  seatCount = 4,
): Point {
  if (seat === localSeat) {
    return { x: size.width / 2, y: size.height - Math.max(56, size.height * 0.16) };
  }
  const visual = visualOffset(seat, localSeat, seatCount);
  const point = seatPoint(visual, size, seatCount);
  const angle = seatAngle(visual, seatCount);
  const inward = 14;
  return {
    x: point.x - Math.cos(angle) * inward,
    y: point.y - Math.sin(angle) * inward,
  };
}

/** Top-center of a reaction mark, just above that seat's avatar. */
export function reactionMarkPoint(
  seat: SeatId,
  localSeat: SeatId,
  size: TableSize,
  seatCount = 4,
  shift = 0,
): Point {
  const visual = visualOffset(seat, localSeat, seatCount);
  const point = seatPoint(visual, size, seatCount);
  const angle = seatAngle(visual, seatCount);
  const outward = 10;
  const above = seat === localSeat ? 28 : 48;
  return {
    x: point.x + Math.cos(angle) * outward + shift,
    y: point.y + Math.sin(angle) * outward - above,
  };
}

export const OPPONENT_CARD = { width: 18, height: 26 };

export function opponentFanFit(
  count: number,
  maxWidth: number,
  cardWidth: number,
): { overlap: number; tiltStep: number } {
  if (count <= 1) {
    return { overlap: 0, tiltStep: 0 };
  }
  const minStride = 3;
  const maxStride = Math.max(minStride, Math.round(cardWidth * 0.22));
  const needed = Math.max(minStride, (maxWidth - cardWidth) / (count - 1));
  const stride = Math.min(maxStride, needed);
  return {
    overlap: cardWidth - stride,
    tiltStep: Math.min(3.2, 16 / (count - 1)),
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
