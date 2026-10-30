export type LaterHandOpener = 'previousFirstFinisher';
export type FourteenCardPolicy = 'dealOrder';

export type RulesConfig = {
  flushEnabled: boolean;
  flushBeatsBomb: boolean;
  aceLowStraightEnabled: boolean;
  aceHighStraightEnabled: boolean;
  firstLeadMustContainThreeOfSpades: boolean;
  cardExchangeEnabled: boolean;
  targetScore: number;
  tieTargetIncrement: number;
  pointsByFinishOrder: [number, number, number, number];
  allowReentryAfterPass: boolean;
  /** Who leads later hands when exchange is disabled. Default: previous first finisher. */
  laterHandOpener: LaterHandOpener;
  /**
   * Who receives 14 cards. Default: clockwise from left of dealer;
   * the first two recipients get the extra card.
   */
  fourteenCardPolicy: FourteenCardPolicy;
  /** Passing on an empty lead is illegal unless this is true. */
  allowPassOnLead: boolean;
};
