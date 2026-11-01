import { ChaosAbilityId } from '../domain';
import { MessageKey } from '../i18n';

export const CHAOS_ABILITY_ORDER: ChaosAbilityId[] = [
  'mindReader',
  'freeze',
  'cardThief',
  'shield',
  'secondChance',
  'wildCard',
  'jokerKing',
  'lastManStanding',
];

export const CHAOS_ABILITY_NAME: Record<ChaosAbilityId, MessageKey> = {
  mindReader: 'chaosMindReader',
  freeze: 'chaosFreeze',
  cardThief: 'chaosCardThief',
  shield: 'chaosShield',
  secondChance: 'chaosSecondChance',
  jokerKing: 'chaosJokerKing',
  wildCard: 'chaosWildCard',
  lastManStanding: 'chaosLastManStanding',
};

export const CHAOS_ABILITY_HINT: Record<ChaosAbilityId, MessageKey> = {
  mindReader: 'chaosMindReaderHint',
  freeze: 'chaosFreezeHint',
  cardThief: 'chaosCardThiefHint',
  shield: 'chaosShieldHint',
  secondChance: 'chaosSecondChanceHint',
  jokerKing: 'chaosJokerKingHint',
  wildCard: 'chaosWildCardHint',
  lastManStanding: 'chaosLastManStandingHint',
};

export const CHAOS_ABILITY_DETAIL: Record<ChaosAbilityId, MessageKey> = {
  mindReader: 'chaosMindReaderDetail',
  freeze: 'chaosFreezeDetail',
  cardThief: 'chaosCardThiefDetail',
  shield: 'chaosShieldDetail',
  secondChance: 'chaosSecondChanceDetail',
  jokerKing: 'chaosJokerKingDetail',
  wildCard: 'chaosWildCardDetail',
  lastManStanding: 'chaosLastManStandingDetail',
};

export const CHAOS_ABILITY_RARITY: Record<ChaosAbilityId, MessageKey> = {
  mindReader: 'chaosRarityEpic',
  freeze: 'chaosRarityRare',
  cardThief: 'chaosRarityEpic',
  shield: 'chaosRarityRare',
  secondChance: 'chaosRarityEpic',
  jokerKing: 'chaosRarityLegendary',
  wildCard: 'chaosRarityEpic',
  lastManStanding: 'chaosRarityLegendary',
};

export const CHAOS_ABILITY_KIND: Record<ChaosAbilityId, MessageKey> = {
  mindReader: 'chaosActiveOnce',
  freeze: 'chaosActiveOnce',
  cardThief: 'chaosActiveOnce',
  shield: 'chaosPassiveAuto',
  secondChance: 'chaosPassiveAuto',
  jokerKing: 'chaosPassiveAuto',
  wildCard: 'chaosActiveOnce',
  lastManStanding: 'chaosPassiveAuto',
};
