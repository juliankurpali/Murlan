import { Card } from '../cards/types';
import { SeatId } from './types';

export function cloneHands(hands: Card[][]): Card[][] {
  return hands.map((hand) => hand.slice());
}

/**
 * Deal clockwise one card at a time starting left of the dealer.
 * With 54 cards and 4 seats this gives 14, 14, 13, 13. fourteenCardPolicy 'dealOrder'
 * means the first two recipients of that clockwise deal get the extra card.
 */
export function dealCards(deck: Card[], dealerSeat: SeatId, seatCount = 4): Card[][] {
  const hands: Card[][] = Array.from({ length: seatCount }, () => []);
  let seat = ((dealerSeat + 1) % seatCount) as SeatId;
  for (const card of deck) {
    hands[seat]?.push(card);
    seat = ((seat + 1) % seatCount) as SeatId;
  }
  return hands;
}

export function dealLimited(
  deck: Card[],
  dealerSeat: SeatId,
  seatCount: number,
  cardsPerPlayer: number,
): { hands: Card[][]; undealt: Card[] } {
  const dealtCount = seatCount * cardsPerPlayer;
  return {
    hands: dealCards(deck.slice(0, dealtCount), dealerSeat, seatCount),
    undealt: deck.slice(dealtCount),
  };
}

export function dealerForHand(handIndex: number, seatCount = 4): SeatId {
  return (handIndex % seatCount) as SeatId;
}
