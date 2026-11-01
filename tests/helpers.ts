import { createDeck, createSeededRandom, DEFAULT_RULES, GameState, SeatId, shuffleDeck } from '../src/domain';
import { Card } from '../src/domain/cards/types';
import { dealCards } from '../src/domain/game/deal';
import { RulesConfig } from '../src/domain/rules/types';

const DECK_INDEX = new Map(createDeck().map((card) => [card.id, card]));

export function C(...ids: string[]): Card[] {
  return ids.map((id) => {
    const card = DECK_INDEX.get(id);
    if (!card) {
      throw new Error(`Unknown card id ${id}`);
    }
    return card;
  });
}

export function card(id: string): Card {
  return C(id)[0]!;
}

export function emptyHands(): Card[][] {
  return [[], [], [], []];
}

export function createPlayingState(
  overrides: Partial<GameState> & {
    hands: Card[][];
    currentSeat?: SeatId;
    rules?: RulesConfig;
  },
): GameState {
  const currentSeat = overrides.currentSeat ?? 0;
  const hands = overrides.hands;
  return {
    schemaVersion: 1,
    mode: '2v2',
    rules:
      overrides.rules ?? {
        ...DEFAULT_RULES,
        firstLeadMustContainThreeOfSpades: false,
      },
    handIndex: 0,
    dealerSeat: 0,
    currentSeat,
    trick: {
      leaderSeat: currentSeat,
      combination: null,
      lastSuccessfulSeat: null,
      passedSinceLastPlay: [],
    },
    finishOrder: [],
    scores: Array.from({ length: hands.length }, () => 0),
    targetScore: 21,
    phase: 'playing',
    history: [],
    winner: null,
    lastHandPoints: null,
    lastExchange: null,
    pendingExchange: null,
    teamOf: hands.length === 6 ? [0, 1, 2, 0, 1, 2] : [0, 1, 0, 1],
    undealt: [],
    ...overrides,
    hands,
  };
}

export function dealtFromSeed(seed: number): Card[][] {
  const deck = shuffleDeck(createDeck(), createSeededRandom(seed));
  return dealCards(deck, 0);
}
