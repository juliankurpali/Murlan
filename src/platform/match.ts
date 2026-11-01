import { applyAutoTurn, nextHand, submitExchange, submitPass, submitPlay } from '../application';
import {
  AbilityActivation,
  ChaosAbilityId,
  GameState,
  MatchMode,
  SEATS,
  SeatId,
  activateAbility,
  announceExtraTurn,
  announcePassives,
  applyJokerKings,
  assignAbilities,
  createGame,
  expirePeeks,
  isRuleError,
  legalMovesForSeat,
  markLastManStanding,
  mathRandomSource,
  publicChaosView,
  resolveFrozenTurns,
  teamId,
  toPublicView,
} from '../domain';
import { baseBotName, withAiLabel } from './ids';
import { PlatformGame, TablePayload, TableSeries } from './types';

export type UserIntent = {
  kind: 'play' | 'pass' | 'exchange' | 'nextHand' | 'playAgain' | 'ability';
  cards?: string[];
  cardId?: string;
  intoCardId?: string;
  abilityId?: ChaosAbilityId;
  targetSeat?: SeatId;
  id?: string;
};

const HUMAN_TURN_MS = 20_000;
const BOT_PLAY_MS = 1_200;
const BOT_NAMES = ['Leka', 'Drita', 'Gjergj', 'Bardh', 'Yllka'];

export function emptySeries(mode: MatchMode = '2v2'): TableSeries {
  const seats = mode === 'super' ? 6 : 4;
  const teams = mode === 'super' ? 3 : 2;
  return {
    matches: 0,
    teamWins: Array.from({ length: teams }, () => 0),
    seatWins: Array.from({ length: seats }, () => 0),
  };
}

export function tallySeries(game: PlatformGame): void {
  if (game.resultRecorded || !game.match || game.match.phase !== 'matchComplete') {
    return;
  }
  const series = game.series ?? emptySeries(game.mode);
  const winner = game.match.winner;
  const teamOf = game.match.teamOf;
  const teamWins = [...series.teamWins];
  const seatWins = [...series.seatWins];
  const bumpTeam = (team: number) => {
    teamWins[team] = (teamWins[team] ?? 0) + 1;
    teamOf.forEach((mapped, seat) => {
      if (mapped === team) {
        seatWins[seat] = (seatWins[seat] ?? 0) + 1;
      }
    });
  };
  if (winner === 'team0') {
    bumpTeam(0);
  } else if (winner === 'team1') {
    bumpTeam(1);
  } else if (winner === 'team2') {
    bumpTeam(2);
  } else if (typeof winner === 'number') {
    seatWins[winner] = (seatWins[winner] ?? 0) + 1;
    const team = teamId(winner, teamOf);
    teamWins[team] = (teamWins[team] ?? 0) + 1;
  }
  game.series = {
    matches: series.matches + 1,
    teamWins,
    seatWins,
  };
  game.resultRecorded = true;
  game.playAgainReady = [];
}

function unusedBotName(game: PlatformGame): string {
  const used = new Set(
    game.seats.map((seat) => (seat.botName ? baseBotName(seat.botName) : '')).filter(Boolean),
  );
  return withAiLabel(BOT_NAMES.find((name) => !used.has(name)) ?? 'Bot');
}

export function seatOf(game: PlatformGame, userId: string): SeatId | null {
  const index = game.seats.findIndex((seat) => seat.userId === userId);
  return index >= 0 ? (index as SeatId) : null;
}

export function botSeats(game: PlatformGame): number[] {
  return game.seats.flatMap((seat, index) => (seat.isBot || !seat.userId ? [index] : []));
}

export function connectedHumans(game: PlatformGame): string[] {
  return game.seats.flatMap((seat) => (seat.userId && seat.connection === 'connected' && !seat.isBot ? [seat.userId] : []));
}

export function humanSeats(game: PlatformGame): SeatId[] {
  return game.seats.flatMap((seat, index) => (seat.userId && !seat.isBot ? [index as SeatId] : []));
}

function settleChaos(game: PlatformGame, extraTurnUsedBefore: boolean) {
  if (!game.match || !game.chaos) {
    return;
  }
  expirePeeks(game.chaos);
  game.match = resolveFrozenTurns(game.match, game.chaos);
  if (!extraTurnUsedBefore && game.match.extraTurnUsed) {
    announceExtraTurn(game.chaos, game.match.currentSeat);
  }
  markLastManStanding(game.match, game.chaos);
}

export function startMatch(game: PlatformGame) {
  if (game.seats.some((seat) => !seat.userId && !seat.isBot)) {
    throw new Error('seats-not-ready');
  }
  const chaosMode = game.mode === 'chaos';
  game.match = createGame({
    random: mathRandomSource(),
    mode: chaosMode ? 'chaos' : game.mode === 'super' ? 'super' : '2v2',
  });
  if (!game.series || game.series.matches === 0) {
    game.series = emptySeries(game.mode);
  }
  game.chaos = null;
  if (chaosMode) {
    game.chaos = assignAbilities(mathRandomSource());
    announcePassives(game.chaos);
    game.match = applyJokerKings(game.match, game.chaos);
    const extra = SEATS.find((seat) => game.chaos?.abilities[seat]?.abilityId === 'secondChance');
    if (extra !== undefined) {
      game.match.extraTurnSeat = extra;
    }
  }
  game.nextHandReady = [];
  game.playAgainReady = [];
  game.resultRecorded = false;
  game.statsRecorded = false;
  game.series = game.series ?? emptySeries();
  game.status = 'playing';
  game.updatedAt = Date.now();
}

export function payloadFor(game: PlatformGame, userId: string): TablePayload | null {
  const seat = seatOf(game, userId);
  if (seat === null || !game.match) {
    return null;
  }
  const view = toPublicView(game.match, seat);
  const legal =
    game.match.phase === 'playing' && game.match.currentSeat === seat ? legalMovesForSeat(game.match, seat) : [];
  const legalCardIds = [...new Set(legal.flatMap((move) => move.map((card) => card.id)))];
  if (game.match.phase === 'exchanging' && game.match.pendingExchange?.firstSeat === seat) {
    const received = game.match.pendingExchange.givenToFirst.id;
    for (const card of game.match.hands[seat]) {
      if (card.id !== received) {
        legalCardIds.push(card.id);
      }
    }
  }
  return {
    gameId: game.id,
    code: game.code,
    seat,
    view,
    legalCardIds,
    humanTurn:
      game.match.currentSeat === seat && (game.match.phase === 'playing' || game.match.phase === 'exchanging'),
    nextHandReady: game.match.phase === 'handComplete' ? game.nextHandReady ?? [] : [],
    playAgainReady: game.match.phase === 'matchComplete' ? game.playAgainReady ?? [] : [],
    series: game.series ?? emptySeries(),
    chaos: game.chaos ? publicChaosView(game.match, game.chaos, seat) : null,
  };
}

export function applyUserIntent(game: PlatformGame, userId: string, intent: UserIntent): GameState {
  const seat = seatOf(game, userId);
  if (seat === null || !game.match) {
    throw new Error('not-in-room');
  }
  if (intent.kind === 'nextHand') {
    if (game.match.phase !== 'handComplete') {
      return dealNextHand(game);
    }
    const ready = new Set(game.nextHandReady ?? []);
    ready.add(seat);
    game.nextHandReady = [...ready] as SeatId[];
    return maybeStartNextHand(game) ?? game.match;
  }
  if (intent.kind === 'playAgain') {
    if (game.match.phase !== 'matchComplete') {
      throw new Error('wrongPhase');
    }
    tallySeries(game);
    const ready = new Set(game.playAgainReady ?? []);
    ready.add(seat);
    game.playAgainReady = [...ready] as SeatId[];
    return maybeStartRematch(game) ?? game.match;
  }
  const extraTurnUsedBefore = Boolean(game.match.extraTurnUsed);
  if (intent.kind === 'ability') {
    if (!game.chaos) {
      throw new Error('chaos-no-ability');
    }
    const assigned = game.chaos.abilities[seat]?.abilityId;
    if (!assigned || (intent.abilityId && intent.abilityId !== assigned)) {
      throw new Error('chaos-no-ability');
    }
    const activation: AbilityActivation = {
      abilityId: assigned,
      targetSeat: intent.targetSeat,
      cardId: intent.cardId,
      intoCardId: intent.intoCardId,
    };
    game.match = activateAbility(game.match, game.chaos, seat, activation);
    settleChaos(game, extraTurnUsedBefore);
    game.updatedAt = Date.now();
    return game.match;
  }
  if (game.match.currentSeat !== seat && intent.kind !== 'exchange') {
    throw new Error('not-your-turn');
  }
  let result: GameState | ReturnType<typeof submitPlay>;
  if (intent.kind === 'pass') {
    result = submitPass(game.match, seat);
  } else if (intent.kind === 'exchange') {
    const card = game.match.hands[seat]?.find((item) => item.id === intent.cardId);
    if (!card) {
      throw new Error('cardNotInHand');
    }
    result = submitExchange(game.match, card, seat);
  } else {
    const cards = (intent.cards ?? []).map((id) => {
      const card = game.match?.hands[seat]?.find((item) => item.id === id);
      if (!card) {
        throw new Error('cardNotInHand');
      }
      return card;
    });
    result = submitPlay(game.match, cards, seat);
  }
  if (isRuleError(result)) {
    throw new Error(result.code);
  }
  game.match = result;
  settleChaos(game, extraTurnUsedBefore);
  if (game.match.phase === 'handComplete' || game.match.phase === 'matchComplete') {
    game.nextHandReady = [];
  }
  if (game.match.phase === 'matchComplete') {
    tallySeries(game);
  }
  game.updatedAt = Date.now();
  return game.match;
}

export function autoAct(game: PlatformGame): boolean {
  const match = game.match;
  if (game.status !== 'playing' || !match || (match.phase !== 'playing' && match.phase !== 'exchanging')) {
    return false;
  }
  const extraTurnUsedBefore = Boolean(match.extraTurnUsed);
  if (game.chaos) {
    expirePeeks(game.chaos);
    const thawed = resolveFrozenTurns(match, game.chaos);
    if (thawed !== match) {
      game.match = thawed;
      settleChaos(game, extraTurnUsedBefore);
      if (game.match.phase === 'handComplete' || game.match.phase === 'matchComplete') {
        game.nextHandReady = [];
      }
      if (game.match.phase === 'matchComplete') {
        tallySeries(game);
      }
      game.updatedAt = Date.now();
      return true;
    }
  }
  const next = applyAutoTurn(match, match.currentSeat);
  if (isRuleError(next)) {
    return false;
  }
  game.match = next;
  settleChaos(game, extraTurnUsedBefore);
  if (game.match.phase === 'handComplete' || game.match.phase === 'matchComplete') {
    game.nextHandReady = [];
  }
  if (game.match.phase === 'matchComplete') {
    tallySeries(game);
  }
  game.updatedAt = Date.now();
  return true;
}

export function turnDelay(game: PlatformGame): number {
  const match = game.match;
  if (!match) {
    return HUMAN_TURN_MS;
  }
  const seat = match.phase === 'exchanging' ? (match.pendingExchange?.firstSeat ?? match.currentSeat) : match.currentSeat;
  const occupant = game.seats[seat];
  if (occupant?.isBot || occupant?.connection !== 'connected') {
    return occupant?.connection !== 'connected' && !occupant?.isBot ? 8_000 : BOT_PLAY_MS;
  }
  return HUMAN_TURN_MS;
}

export function connectedHumanSeats(game: PlatformGame) {
  return game.seats.filter(
    (seat) =>
      Boolean(seat.userId) &&
      !seat.isBot &&
      (seat.connection === 'connected' || seat.connection === 'restoring' || seat.connection === 'reconnecting'),
  );
}

export function connectedHumanSeatIds(game: PlatformGame): SeatId[] {
  return game.seats.flatMap((seat, index) =>
    Boolean(seat.userId) &&
    !seat.isBot &&
    (seat.connection === 'connected' || seat.connection === 'restoring' || seat.connection === 'reconnecting')
      ? [index as SeatId]
      : [],
  );
}

function dealNextHand(game: PlatformGame): GameState {
  const next = nextHand(game.match!, mathRandomSource(), botSeats(game));
  if (isRuleError(next)) {
    throw new Error(next.code);
  }
  game.match = next;
  game.nextHandReady = [];
  game.updatedAt = Date.now();
  return next;
}

export function maybeStartRematch(game: PlatformGame): GameState | null {
  if (!game.match || game.match.phase !== 'matchComplete') {
    return null;
  }
  const ready = new Set(game.playAgainReady ?? []);
  for (const bot of botSeats(game)) {
    ready.add(bot as SeatId);
  }
  game.playAgainReady = [...ready] as SeatId[];
  if (connectedHumanSeatIds(game).some((human) => !ready.has(human))) {
    game.updatedAt = Date.now();
    return null;
  }
  startMatch(game);
  return game.match;
}

export function maybeStartNextHand(game: PlatformGame): GameState | null {
  if (!game.match || game.match.phase !== 'handComplete') {
    return null;
  }
  const ready = new Set(game.nextHandReady ?? []);
  for (const bot of botSeats(game)) {
    ready.add(bot as SeatId);
  }
  game.nextHandReady = [...ready] as SeatId[];
  if (connectedHumanSeatIds(game).some((human) => !ready.has(human))) {
    game.updatedAt = Date.now();
    return null;
  }
  return dealNextHand(game);
}

export function endIfNoHumans(game: PlatformGame): boolean {
  if (game.status === 'complete') {
    return false;
  }
  if (connectedHumanSeats(game).length > 0) {
    return false;
  }
  return forceEndGame(game);
}

export function forceEndGame(game: PlatformGame): boolean {
  if (game.status === 'complete') {
    return false;
  }
  game.status = 'complete';
  game.updatedAt = Date.now();
  game.chat = [];
  if (game.match && game.match.phase !== 'matchComplete') {
    game.match = { ...game.match, phase: 'matchComplete', winner: null };
  }
  return true;
}

export function parkPlayer(game: PlatformGame, userId: string, intentional: boolean) {
  const seat = game.seats.find((row) => row.userId === userId);
  if (!seat) {
    return false;
  }
  if (intentional && game.status === 'lobby') {
    seat.userId = null;
    seat.connection = 'abandoned';
    seat.isBot = false;
    seat.lobbyReady = false;
    seat.botName = null;
    return endIfNoHumans(game);
  }
  if (intentional && game.status === 'playing') {
    seat.isBot = true;
    seat.connection = 'abandoned';
    seat.botName = seat.botName ?? unusedBotName(game);
    const ended = endIfNoHumans(game);
    if (!ended) {
      maybeStartNextHand(game);
      maybeStartRematch(game);
    }
    return ended;
  }
  seat.connection = 'disconnected';
  const ended = endIfNoHumans(game);
  if (!ended) {
    maybeStartNextHand(game);
    maybeStartRematch(game);
  }
  return ended;
}

export function restorePlayer(game: PlatformGame, userId: string) {
  if (game.status === 'complete') {
    return;
  }
  const seat = game.seats.find((row) => row.userId === userId);
  if (!seat) {
    return;
  }
  seat.connection = 'connected';
  seat.isBot = false;
  seat.botName = null;
}

export function tableFromStore(game: PlatformGame, userId: string): TablePayload | null {
  return payloadFor(game, userId);
}
