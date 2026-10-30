import { RulesConfig } from '../rules/types';
import { GameState, MatchWinner, SeatId, SEATS, teamId } from './types';
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

export function scoreHand(state: GameState, rules: RulesConfig): ScoreResult {
  const remaining = unfinishedSeats(state.finishOrder);
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

  if (state.mode === '2v2') {
    return scoreTeams(scores, pointsThisHand, state.targetScore, rules);
  }
  return scoreIndividuals(scores, pointsThisHand, state.targetScore, rules);
}

function scoreIndividuals(
  scores: [number, number, number, number],
  pointsThisHand: [number, number, number, number],
  targetScore: number,
  rules: RulesConfig,
): ScoreResult {
  const reached = SEATS.filter((seat) => scores[seat] >= targetScore);
  if (reached.length >= 2) {
    return {
      pointsThisHand,
      scores,
      targetScore: targetScore + rules.tieTargetIncrement,
      phase: 'handComplete',
      winner: null,
    };
  }
  if (reached.length === 1) {
    return {
      pointsThisHand,
      scores,
      targetScore,
      phase: 'matchComplete',
      winner: reached[0] as SeatId,
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
