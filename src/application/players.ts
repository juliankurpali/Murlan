import { SeatId } from '../domain';

export type SeatAppearance = {
  profileUri: string | null;
  tone: number;
};

export function appearanceForSeat(
  seat: SeatId,
  human?: SeatAppearance | null,
  localSeat: SeatId = 0,
): SeatAppearance {
  if (seat === localSeat) {
    return {
      profileUri: human?.profileUri ?? null,
      tone: 0,
    };
  }
  return { profileUri: null, tone: ((seat - localSeat + 6) % 6) || 1 };
}
