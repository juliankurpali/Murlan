import { SUPER_MURLAN } from '../game/mode';
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
  minimumWinningLead: 0,
  allowReentryAfterPass: true,
  laterHandOpener: 'previousFirstFinisher',
  fourteenCardPolicy: 'dealOrder',
  allowPassOnLead: false,
};

export const SUPER_RULES: Partial<RulesConfig> = {
  targetScore: SUPER_MURLAN.targetScore,
  pointsByFinishOrder: [...SUPER_MURLAN.pointsByFinishOrder],
  minimumWinningLead: SUPER_MURLAN.minimumWinningLead,
};

export function mergeRules(overrides?: Partial<RulesConfig>): RulesConfig {
  return { ...DEFAULT_RULES, ...overrides };
}
