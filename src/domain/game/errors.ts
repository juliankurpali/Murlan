import { RuleError, RuleErrorCode } from './types';

export function ruleError(code: RuleErrorCode, message: string): RuleError {
  return { type: 'RuleError', code, message };
}
