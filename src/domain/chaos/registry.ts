import { AbilityDefinition, ChaosAbilityId } from './types';

export const ABILITY_DEFINITIONS: Record<ChaosAbilityId, AbilityDefinition> = {
  mindReader: {
    id: 'mindReader',
    rarity: 'epic',
    weight: 10,
    activationType: 'active',
    maxUses: 1,
    targeting: 'opponent',
    hostile: true,
    enabled: true,
  },
  freeze: {
    id: 'freeze',
    rarity: 'rare',
    weight: 10,
    activationType: 'active',
    maxUses: 1,
    targeting: 'opponent',
    hostile: true,
    enabled: true,
  },
  cardThief: {
    id: 'cardThief',
    rarity: 'epic',
    weight: 10,
    activationType: 'active',
    maxUses: 1,
    targeting: 'opponent',
    hostile: true,
    enabled: true,
  },
  shield: {
    id: 'shield',
    rarity: 'rare',
    weight: 15,
    activationType: 'passive',
    maxUses: 1,
    targeting: 'none',
    hostile: false,
    enabled: true,
  },
  secondChance: {
    id: 'secondChance',
    rarity: 'epic',
    weight: 10,
    activationType: 'passive',
    maxUses: 1,
    targeting: 'none',
    hostile: false,
    enabled: true,
  },
  jokerKing: {
    id: 'jokerKing',
    rarity: 'legendary',
    weight: 5,
    activationType: 'passive',
    maxUses: 0,
    targeting: 'none',
    hostile: false,
    enabled: true,
  },
  wildCard: {
    id: 'wildCard',
    rarity: 'epic',
    weight: 15,
    activationType: 'active',
    maxUses: 1,
    targeting: 'ownCard',
    hostile: false,
    enabled: true,
  },
  lastManStanding: {
    id: 'lastManStanding',
    rarity: 'legendary',
    weight: 25,
    activationType: 'passive',
    maxUses: 0,
    targeting: 'none',
    hostile: false,
    enabled: true,
  },
};

export function abilityDefinition(id: ChaosAbilityId): AbilityDefinition {
  return ABILITY_DEFINITIONS[id];
}

export function enabledAbilities(exclude: ChaosAbilityId[] = []): AbilityDefinition[] {
  const blocked = new Set(exclude);
  return Object.values(ABILITY_DEFINITIONS).filter((row) => row.enabled && !blocked.has(row.id));
}
