import { RulesConfig } from '../rules/types';
import { GameState, MatchWinner, SeatId, TeamScores, teamId } from './types';
import { seatCountOf, unfinishedSeats } from './seats';

export type ScoreResult = {
  pointsThisHand: number[];
  scores: number[];
  targetScore: number;
  phase: GameState['phase'];
  winner: MatchWinner | null;
};

export function teamScores(scores: number[], teamOf?: number[]): TeamScores {
  const map = teamOf ?? scores.map((_, seat) => teamId(seat as SeatId));
  const totals = [0, 0, 0];
  scores.forEach((score, seat) => {
    const team = map[seat] ?? 0;
    totals[team] = (totals[team] ?? 0) + score;
  });
  if (map.includes(2)) {
    return { team0: totals[0] ?? 0, team1: totals[1] ?? 0, team2: totals[2] ?? 0 };
  }
  return { team0: totals[0] ?? 0, team1: totals[1] ?? 0 };
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

function pointsForOrder(order: SeatId[], table: readonly number[], seatCount: number): number[] {
  const points = Array.from({ length: seatCount }, () => 0);
  order.forEach((seat, index) => {
    points[seat] = table[index] ?? 0;
  });
  return points;
}

/** Remaining seats, soonest-out first (fewest cards, then seat number). */
export function remainingFinishOrder(state: GameState): SeatId[] {
  return unfinishedSeats(state.finishOrder, seatCountOf(state)).slice().sort((a, b) => {
    const byCards = (state.hands[a]?.length ?? 0) - (state.hands[b]?.length ?? 0);
    return byCards !== 0 ? byCards : a - b;
  });
}

/**
 * Unique winner already locked by remaining places, or null if the hand must continue.
 * Super Murlan waits for the round to finish before checking 150 + lead.
 */
export function lockedMatchWinner(state: GameState, rules: RulesConfig = state.rules): MatchWinner | null {
  if (state.mode === 'super' || rules.minimumWinningLead > 0) {
    return null;
  }
  if (state.finishOrder.length === 0) {
    return null;
  }
  const count = seatCountOf(state);
  const rest = unfinishedSeats(state.finishOrder, count);
  const table = rules.pointsByFinishOrder;
  const assignments = rest.length === 0 ? [[]] : permutations(rest);
  const target = state.targetScore;
  const map = state.teamOf;

  let min0 = Infinity;
  let max0 = -Infinity;
  let min1 = Infinity;
  let max1 = -Infinity;
  for (const perm of assignments) {
    const order = [...state.finishOrder, ...perm];
    const pts = pointsForOrder(order, table, count);
    const t0 = (state.scores[0] ?? 0) + (pts[0] ?? 0) + (state.scores[2] ?? 0) + (pts[2] ?? 0);
    const t1 = (state.scores[1] ?? 0) + (pts[1] ?? 0) + (state.scores[3] ?? 0) + (pts[3] ?? 0);
    min0 = Math.min(min0, t0);
    max0 = Math.max(max0, t0);
    min1 = Math.min(min1, t1);
    max1 = Math.max(max1, t1);
  }
  if (map.includes(2)) {
    return null;
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
  const count = seatCountOf(state);
  const remaining = remainingFinishOrder(state);
  const fullOrder = [...state.finishOrder, ...remaining];
  const pointsThisHand = Array.from({ length: count }, () => 0);

  fullOrder.forEach((seat, index) => {
    pointsThisHand[seat] = rules.pointsByFinishOrder[index] ?? 0;
  });

  const scores = state.scores.map((score, seat) => score + (pointsThisHand[seat] ?? 0));
  return decideWinner(scores, pointsThisHand, state, rules);
}

function decideWinner(
  scores: number[],
  pointsThisHand: number[],
  state: GameState,
  rules: RulesConfig,
): ScoreResult {
  const teams = teamScores(scores, state.teamOf);
  const lead = rules.minimumWinningLead;
  if (lead > 0 || state.mode === 'super') {
    return decideSuperWinner(scores, pointsThisHand, teams, state.targetScore, lead);
  }
  return scoreClassicTeams(scores, pointsThisHand, state.targetScore, rules);
}

function decideSuperWinner(
  scores: number[],
  pointsThisHand: number[],
  teams: TeamScores,
  targetScore: number,
  lead: number,
): ScoreResult {
  const values = [teams.team0, teams.team1, teams.team2 ?? Number.NEGATIVE_INFINITY];
  const labels: MatchWinner[] = ['team0', 'team1', 'team2'];
  let best = 0;
  for (let i = 1; i < 3; i += 1) {
    if ((values[i] ?? 0) > (values[best] ?? 0)) {
      best = i;
    }
  }
  const top = values[best] ?? 0;
  const second = values.filter((_, index) => index !== best).reduce((max, n) => Math.max(max, n ?? 0), 0);
  const tied = values.filter((value) => value === top).length > 1;
  if (!tied && top >= targetScore && top - second >= lead) {
    return {
      pointsThisHand,
      scores,
      targetScore,
      phase: 'matchComplete',
      winner: labels[best] ?? 'team0',
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

function scoreClassicTeams(
  scores: number[],
  pointsThisHand: number[],
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
