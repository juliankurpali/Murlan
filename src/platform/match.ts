import { applyAutoTurn, nextHand, submitExchange, submitPass, submitPlay } from '../application';
import {
  GameState,
  SeatId,
  createGame,
  isRuleError,
  legalMovesForSeat,
  mathRandomSource,
  toPublicView,
} from '../domain';
import { PlatformGame, TablePayload } from './types';

const HUMAN_TURN_MS = 20_000;
const BOT_PLAY_MS = 1_200;
const BOT_NAMES = ['Leka', 'Drita', 'Gjergj'];

function unusedBotName(game: PlatformGame): string {
  const used = new Set(game.seats.map((seat) => seat.botName).filter((name): name is string => Boolean(name)));
  return BOT_NAMES.find((name) => !used.has(name)) ?? 'Bot';
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

export function startMatch(game: PlatformGame) {
  if (game.seats.some((seat) => !seat.userId && !seat.isBot)) {
    throw new Error('seats-not-ready');
  }
  game.match = createGame({ mode: game.mode, random: mathRandomSource() });
  game.nextHandReady = [];
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
  };
}

export function applyUserIntent(
  game: PlatformGame,
  userId: string,
  intent: { kind: 'play' | 'pass' | 'exchange' | 'nextHand'; cards?: string[]; cardId?: string; id?: string },
): GameState {
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
  if (result.phase === 'handComplete' || result.phase === 'matchComplete') {
    game.nextHandReady = [];
  }
  game.updatedAt = Date.now();
  return result;
}

export function autoAct(game: PlatformGame): boolean {
  const match = game.match;
  if (game.status !== 'playing' || !match || (match.phase !== 'playing' && match.phase !== 'exchanging')) {
    return false;
  }
  const next = applyAutoTurn(match, match.currentSeat);
  if (isRuleError(next)) {
    return false;
  }
  game.match = next;
  if (next.phase === 'handComplete' || next.phase === 'matchComplete') {
    game.nextHandReady = [];
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
    }
    return ended;
  }
  seat.connection = 'disconnected';
  const ended = endIfNoHumans(game);
  if (!ended) {
    maybeStartNextHand(game);
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
