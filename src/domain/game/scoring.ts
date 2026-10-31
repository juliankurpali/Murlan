import { RulesConfig } from '../rules/types';
import { GameState, MatchWinner, SeatId, teamId } from './types';
import { unfinishedSeats } from './seats';

export type ScoreResult = {
  pointsThisHand: [number, number, number, number];
  scores: [number, number, number, number];
  targetScore: number;
  phase: GameState['phase'];
  winner: MatchWinner | null;
};

export function teamScores(scores: [number, number, number, number]): { team0: number; team1: number } {
  return {
    team0: scores[0] + scores[2],
    team1: scores[1] + scores[3],
  };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items.slice()];
  }
  const out: T[][] = [];
  items.forEach((item, index) => {
    const rest = items.slice(0, index).concat(items.slice(index + 1));
    for (const perm of permutations(rest)) {
      out.push([item, ...perm]);
    }
  });
  return out;
}

function pointsForOrder(order: SeatId[], table: readonly number[]): [number, number, number, number] {
  const points: [number, number, number, number] = [0, 0, 0, 0];
  order.forEach((seat, index) => {
    points[seat] = table[index] ?? 0;
  });
  return points;
}

/** Remaining seats, soonest-out first (fewest cards, then seat number). */
export function remainingFinishOrder(state: GameState): SeatId[] {
  return unfinishedSeats(state.finishOrder).slice().sort((a, b) => {
    const byCards = state.hands[a].length - state.hands[b].length;
    return byCards !== 0 ? byCards : a - b;
  });
}

/**
 * Unique winner already locked by remaining places, or null if the hand must continue.
 * Does not require anyone to sit on exactly 21 — reaching the target is enough,
 * and the other side must be unable to reach it.
 */
export function lockedMatchWinner(state: GameState, rules: RulesConfig = state.rules): MatchWinner | null {
  if (state.finishOrder.length === 0) {
    return null;
  }
  const rest = unfinishedSeats(state.finishOrder);
  const table = rules.pointsByFinishOrder;
  const assignments = rest.length === 0 ? [[]] : permutations(rest);
  const target = state.targetScore;

  let min0 = Infinity;
  let max0 = -Infinity;
  let min1 = Infinity;
  let max1 = -Infinity;
  for (const perm of assignments) {
    const order = [...state.finishOrder, ...perm];
    const pts = pointsForOrder(order, table);
    const t0 = state.scores[0] + pts[0] + state.scores[2] + pts[2];
    const t1 = state.scores[1] + pts[1] + state.scores[3] + pts[3];
    min0 = Math.min(min0, t0);
    max0 = Math.max(max0, t0);
    min1 = Math.min(min1, t1);
    max1 = Math.max(max1, t1);
  }
  if (min0 >= target && max1 < target) {
    return 'team0';
  }
  if (min1 >= target && max0 < target) {
    return 'team1';
  }
  return null;
}

export function scoreHand(state: GameState, rules: RulesConfig): ScoreResult {
  const remaining = remainingFinishOrder(state);
  const fullOrder = [...state.finishOrder, ...remaining];
  const pointsThisHand: [number, number, number, number] = [0, 0, 0, 0];

  fullOrder.forEach((seat, index) => {
    const points = rules.pointsByFinishOrder[index] ?? 0;
    pointsThisHand[seat] = points;
  });

  const scores: [number, number, number, number] = [
    state.scores[0] + pointsThisHand[0],
    state.scores[1] + pointsThisHand[1],
    state.scores[2] + pointsThisHand[2],
    state.scores[3] + pointsThisHand[3],
  ];

  return scoreTeams(scores, pointsThisHand, state.targetScore, rules);
}

function scoreTeams(
  scores: [number, number, number, number],
  pointsThisHand: [number, number, number, number],
  targetScore: number,
  rules: RulesConfig,
): ScoreResult {
  const teams = teamScores(scores);
  const team0Reached = teams.team0 >= targetScore;
  const team1Reached = teams.team1 >= targetScore;

  if (team0Reached && team1Reached) {
    return {
      pointsThisHand,
      scores,
      targetScore: targetScore + rules.tieTargetIncrement,
      phase: 'handComplete',
      winner: null,
    };
  }
  if (team0Reached) {
    return {
      pointsThisHand,
      scores,
      targetScore,
      phase: 'matchComplete',
      winner: 'team0',
    };
  }
  if (team1Reached) {
    return {
      pointsThisHand,
      scores,
      targetScore,
      phase: 'matchComplete',
      winner: 'team1',
    };
  }
  return {
    pointsThisHand,
    scores,
    targetScore,
    phase: 'handComplete',
    winner: null,
  };
}

export { teamId };
