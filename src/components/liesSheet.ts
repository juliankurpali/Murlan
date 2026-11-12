import { isPhoneViewport } from './tableLayout';

export type LiesSheetMetrics = {
  phone: boolean;
  width: number;
  maxHeight: number;
  padding: number;
  gap: number;
  cardW: number;
  cardH: number;
  titleSize: number;
  hintSize: number;
};

/** Shared comfortable sheet sizing for Lies claim / reveal / book overlays. */
export function liesSheetMetrics(
  stageW: number,
  stageH: number,
  padL = 0,
  padR = 0,
  padT = 0,
  padB = 0,
): LiesSheetMetrics {
  const phone = isPhoneViewport(stageW, stageH);
  const width = Math.min(
    stageW - Math.max(padL, 12) - Math.max(padR, 12) - (phone ? 8 : 24),
    phone ? 560 : 440,
  );
  const maxHeight = Math.min(
    stageH - Math.max(padT, 10) - Math.max(padB, 10) - 12,
    phone ? stageH * 0.92 : stageH * 0.86,
  );
  return {
    phone,
    width,
    maxHeight,
    padding: phone ? 12 : 16,
    gap: phone ? 8 : 10,
    // Keep faces readable on phone landscape (CardFace art needs real pixel room).
    cardW: phone ? 44 : 48,
    cardH: phone ? 64 : 70,
    titleSize: phone ? 17 : 22,
    hintSize: phone ? 12 : 13,
  };
}
