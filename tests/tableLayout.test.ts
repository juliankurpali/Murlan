import { clampHandSize, DEFAULT_HAND_SIZE, HAND_SIZE_MAX, HAND_SIZE_MIN } from '../src/application/types';
import { SeatId } from '../src/domain';
import {
  fitHandCards,
  HAND_CARD_MAX,
  HAND_CARD_PHONE,
  opponentFanFit,
  playOriginPoint,
  scaledHandCard,
  seatPoint,
  tableCenter,
  visualOffset,
} from '../src/components/tableLayout';

function span(count: number, width: number, overlap: number) {
  return width + Math.max(0, count - 1) * (width - overlap);
}

describe('fitHandCards', () => {
  it('keeps full-size cards when the table is wide enough', () => {
    const fit = fitHandCards(8, 900);
    expect(fit.width).toBe(HAND_CARD_MAX.width);
    expect(fit.height).toBe(HAND_CARD_MAX.height);
  });

  it('shows about 65% of each card so a long hand can scroll', () => {
    const fit = fitHandCards(14, 360, HAND_CARD_PHONE);
    expect(fit.width).toBe(HAND_CARD_PHONE.width);
    expect(fit.height).toBe(HAND_CARD_PHONE.height);
    const visible = (fit.width - fit.overlap) / fit.width;
    expect(visible).toBeGreaterThanOrEqual(0.58);
    expect(visible).toBeLessThanOrEqual(0.72);
  });

  it('does not crush overlap just to fit 14 cards in a narrow strip', () => {
    const available = 180;
    const fit = fitHandCards(14, available);
    expect(fit.width).toBe(HAND_CARD_MAX.width);
    expect(span(14, fit.width, fit.overlap)).toBeGreaterThan(available);
  });
});

describe('opponentFanFit', () => {
  it('renders one back per remaining card within a max width', () => {
    const cardWidth = 18;
    const maxWidth = 80;
    const fit = opponentFanFit(14, maxWidth, cardWidth);
    expect(span(14, cardWidth, fit.overlap)).toBeLessThanOrEqual(maxWidth + 1);
  });

  it('keeps a 13-card Super fan in a short stack', () => {
    const cardWidth = 18;
    const fit = opponentFanFit(13, 92, cardWidth);
    expect(span(13, cardWidth, fit.overlap)).toBeLessThanOrEqual(72);
  });

  it('uses no overlap for a single remaining card', () => {
    expect(opponentFanFit(1, 108, 18)).toEqual({ overlap: 0, tiltStep: 0 });
  });
});

describe('seatPoint', () => {
  const size = { width: 800, height: 400 };

  it('sits four players on the oval: you south, partner north, rivals east and west', () => {
    const south = seatPoint(0, size, 4);
    const west = seatPoint(1, size, 4);
    const north = seatPoint(2, size, 4);
    const east = seatPoint(3, size, 4);
    expect(south.y).toBeGreaterThan(size.height / 2);
    expect(north.y).toBeLessThan(size.height / 2);
    expect(west.x).toBeLessThan(size.width / 2);
    expect(east.x).toBeGreaterThan(size.width / 2);
    expect(Math.abs(south.x - size.width / 2)).toBeLessThan(2);
    expect(Math.abs(north.x - size.width / 2)).toBeLessThan(2);
  });

  it('sits six Super players around the oval with a gap at the south hand', () => {
    const south = seatPoint(0, size, 6);
    const southwest = seatPoint(1, size, 6);
    const northwest = seatPoint(2, size, 6);
    const north = seatPoint(3, size, 6);
    const northeast = seatPoint(4, size, 6);
    const southeast = seatPoint(5, size, 6);
    expect(north.y).toBeLessThan(southwest.y);
    expect(southwest.y).toBeLessThan(south.y);
    expect(southwest.x).toBeLessThan(size.width / 2);
    expect(southeast.x).toBeGreaterThan(size.width / 2);
    expect(northwest.y).toBeLessThan(size.height / 2);
    expect(northeast.y).toBeLessThan(size.height / 2);
    expect(Math.abs(north.x - size.width / 2)).toBeLessThan(2);
  });
});

describe('tableCenter', () => {
  it('sits above the geometric middle so the pile clears the south hand', () => {
    const size = { width: 900, height: 420 };
    const center = tableCenter(size);
    expect(center.x).toBe(size.width / 2);
    expect(center.y).toBeLessThan(size.height / 2);
    expect(center.y).toBeGreaterThan(size.height * 0.3);
  });
});

describe('visualOffset', () => {
  it('keeps you at the bottom and your partner across the table', () => {
    expect(visualOffset(0, 0)).toBe(0);
    expect(visualOffset(2, 0)).toBe(2);
    expect(visualOffset(2, 2)).toBe(0);
    expect(visualOffset(0, 2)).toBe(2);
  });

  it('maps six seats so the opposite teammate sits north', () => {
    expect(visualOffset(3, 0, 6)).toBe(3);
    expect(visualOffset(0, 3, 6)).toBe(3);
    expect(visualOffset(4, 1, 6)).toBe(3);
  });
});

describe('playOriginPoint', () => {
  const size = { width: 900, height: 420 };

  it('leaves your cards from the south hand', () => {
    const fromYou = playOriginPoint(0, 0, size);
    expect(fromYou.x).toBe(size.width / 2);
    expect(fromYou.y).toBeGreaterThan(size.height * 0.7);
  });

  it('leaves an opponent play from their seat, not the pile', () => {
    const fromWest = playOriginPoint(1, 0, size);
    const pile = { x: size.width / 2, y: size.height / 2 };
    expect(fromWest.x).toBeLessThan(pile.x - 80);
    expect(Math.abs(fromWest.y - pile.y)).toBeLessThan(size.height / 2);
  });

  it('starts a Super play from the oval seat that player occupies', () => {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    for (const local of [0, 2, 5] as const) {
      for (let seat = 0; seat < 6; seat += 1) {
        if (seat === local) {
          continue;
        }
        const origin = playOriginPoint(seat as SeatId, local, size, 6);
        const visual = visualOffset(seat as SeatId, local, 6);
        const sitting = seatPoint(visual, size, 6);
        expect(dist(origin, sitting)).toBeLessThan(24);
        for (let other = 0; other < 6; other += 1) {
          if (other === visual) {
            continue;
          }
          expect(dist(origin, sitting)).toBeLessThan(dist(origin, seatPoint(other as SeatId, size, 6)));
        }
      }
    }
  });
});

describe('hand size steps', () => {
  it('clamps to the plus/minus range', () => {
    expect(clampHandSize(DEFAULT_HAND_SIZE)).toBe(DEFAULT_HAND_SIZE);
    expect(clampHandSize(-3)).toBe(HAND_SIZE_MIN);
    expect(clampHandSize(99)).toBe(HAND_SIZE_MAX);
    expect(clampHandSize('big')).toBe(DEFAULT_HAND_SIZE);
  });

  it('makes the local hand smaller or bigger from the default', () => {
    const smaller = scaledHandCard(HAND_CARD_PHONE, HAND_SIZE_MIN);
    const bigger = scaledHandCard(HAND_CARD_PHONE, HAND_SIZE_MAX);
    expect(smaller.width).toBeLessThan(HAND_CARD_PHONE.width);
    expect(smaller.height).toBeLessThan(HAND_CARD_PHONE.height);
    expect(bigger.width).toBeGreaterThan(HAND_CARD_PHONE.width);
    expect(bigger.height).toBeGreaterThan(HAND_CARD_PHONE.height);
    expect(scaledHandCard(HAND_CARD_PHONE, DEFAULT_HAND_SIZE)).toEqual(HAND_CARD_PHONE);
  });
});
