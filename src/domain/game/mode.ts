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

export function isLiesMode(mode: MatchMode): boolean {
  return mode === 'lies';
}

export function playerCountFor(mode: MatchMode, liesPlayers = 4): number {
  if (mode === 'super') return SUPER_MURLAN.maxPlayers;
  if (mode === 'lies') return Math.min(6, Math.max(3, liesPlayers));
  return 4;
}

export function seatsForMode(mode: MatchMode, liesPlayers = 4): SeatId[] {
  if (mode === 'super') return SUPER_SEATS;
  if (mode === 'lies') {
    return Array.from({ length: playerCountFor('lies', liesPlayers) }, (_, i) => i as SeatId);
  }
  return CLASSIC_SEATS;
}

export function defaultTeamOf(mode: MatchMode): number[] {
  if (mode === 'super') {
    return [0, 1, 2, 0, 1, 2];
  }
  if (mode === 'lies') {
    return [0, 1, 2, 3, 4, 5];
  }
  return [0, 1, 0, 1];
}

export function teamCountFor(mode: MatchMode): number {
  if (mode === 'super') return SUPER_MURLAN.teamCount;
  if (mode === 'lies') return 0;
  return 2;
}
