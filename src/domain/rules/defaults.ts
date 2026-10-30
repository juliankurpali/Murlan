import { RulesConfig } from './types';

export const DEFAULT_RULES: RulesConfig = {
  flushEnabled: true,
  flushBeatsBomb: true,
  aceLowStraightEnabled: true,
  aceHighStraightEnabled: true,
  firstLeadMustContainThreeOfSpades: true,
  cardExchangeEnabled: true,
  targetScore: 21,
  tieTargetIncrement: 10,
  pointsByFinishOrder: [3, 2, 1, 0],
  allowReentryAfterPass: true,
  laterHandOpener: 'previousFirstFinisher',
  fourteenCardPolicy: 'dealOrder',
  allowPassOnLead: false,
};

export function mergeRules(overrides?: Partial<RulesConfig>): RulesConfig {
  return { ...DEFAULT_RULES, ...overrides };
}
