import { MatchMode, SeatId } from './types';

export const SUPER_MURLAN = {
  mode: 'super' as const,
  maxPlayers: 6,
  teamCount: 3,
  playersPerTeam: 2,
  cardsPerPlayer: 13,
  totalCards: 82,
  undealtCards: 4,
  targetScore: 150,
  minimumWinningLead: 10,
  pointsByFinishOrder: [15, 12, 9, 6, 3, 1] as const,
};

export const CLASSIC_SEATS: SeatId[] = [0, 1, 2, 3];
export const SUPER_SEATS: SeatId[] = [0, 1, 2, 3, 4, 5];

export function isSuperMode(mode: MatchMode): boolean {
  return mode === 'super';
}

export function playerCountFor(mode: MatchMode): number {
  return mode === 'super' ? SUPER_MURLAN.maxPlayers : 4;
}

export function seatsForMode(mode: MatchMode): SeatId[] {
  return mode === 'super' ? SUPER_SEATS : CLASSIC_SEATS;
}

export function defaultTeamOf(mode: MatchMode): number[] {
  if (mode === 'super') {
    return [0, 1, 2, 0, 1, 2];
  }
  return [0, 1, 0, 1];
}

export function teamCountFor(mode: MatchMode): number {
  return mode === 'super' ? SUPER_MURLAN.teamCount : 2;
}
