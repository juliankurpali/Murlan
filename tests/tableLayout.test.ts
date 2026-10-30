import { fitHandCards, HAND_CARD_MAX, HAND_CARD_PHONE, opponentFanFit, visualOffset } from '../src/components/tableLayout';

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
    const cardWidth = 26;
    const maxWidth = 108;
    const fit = opponentFanFit(14, maxWidth, cardWidth);
    expect(span(14, cardWidth, fit.overlap)).toBeLessThanOrEqual(maxWidth + 1);
  });

  it('uses no overlap for a single remaining card', () => {
    expect(opponentFanFit(1, 108, 26)).toEqual({ overlap: 0, tiltStep: 0 });
  });
});

describe('visualOffset', () => {
  it('keeps you at the bottom and your partner across the table', () => {
    expect(visualOffset(0, 0)).toBe(0);
    expect(visualOffset(2, 0)).toBe(2);
    expect(visualOffset(2, 2)).toBe(0);
    expect(visualOffset(0, 2)).toBe(2);
  });
});
