import { Card } from '../cards/types';
import { SeatId } from './types';

/**
 * Deal clockwise one card at a time starting left of the dealer.
 * With 54 cards this gives 14, 14, 13, 13. fourteenCardPolicy 'dealOrder'
 * means the first two recipients of that clockwise deal get the extra card.
 */
export function dealCards(deck: Card[], dealerSeat: SeatId): [Card[], Card[], Card[], Card[]] {
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  let seat: SeatId = ((dealerSeat + 1) % 4) as SeatId;
  for (const card of deck) {
    hands[seat].push(card);
    seat = ((seat + 1) % 4) as SeatId;
  }
  return hands;
}

export function dealerForHand(handIndex: number): SeatId {
  return (handIndex % 4) as SeatId;
}
