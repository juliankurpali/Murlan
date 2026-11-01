import { Card } from '../cards/types';
import { SeatId } from '../game/types';

export type ChaosAbilityId =
  | 'mindReader'
  | 'freeze'
  | 'cardThief'
  | 'shield'
  | 'secondChance'
  | 'jokerKing'
  | 'wildCard'
  | 'lastManStanding';

export type AbilityActivationType = 'active' | 'passive';
export type AbilityRarity = 'rare' | 'epic' | 'legendary';
export type AbilityTargeting = 'none' | 'opponent' | 'ownCard';
export type ChaosNoticeAudience = 'all' | 'source' | 'target' | 'pair';

export type AbilityDefinition = {
  id: ChaosAbilityId;
  rarity: AbilityRarity;
  weight: number;
  activationType: AbilityActivationType;
  maxUses: number;
  targeting: AbilityTargeting;
  hostile: boolean;
  enabled: boolean;
};

export type PlayerAbility = {
  seat: SeatId;
  abilityId: ChaosAbilityId;
  remainingUses: number;
  consumed: boolean;
};

export type ChaosPeek = {
  viewer: SeatId;
  target: SeatId;
  expiresAt: number;
};

export type ChaosNotice = {
  id: string;
  abilityId: ChaosAbilityId;
  sourceSeat?: SeatId;
  targetSeat?: SeatId;
  audience: ChaosNoticeAudience;
  key: string;
  at: number;
};

export type ChaosState = {
  abilities: Array<PlayerAbility | null>;
  freezeNext: SeatId[];
  peeks: ChaosPeek[];
  specialVictorySeat: SeatId | null;
  notices: ChaosNotice[];
  wildSeq: number;
};

export type ChaosOwnAbility = {
  abilityId: ChaosAbilityId;
  activationType: AbilityActivationType;
  remainingUses: number;
  consumed: boolean;
  targeting: AbilityTargeting;
};

export type PublicChaosView = {
  active: true;
  own: ChaosOwnAbility | null;
  revealedHand: { seat: SeatId; cards: Card[]; expiresAt: number } | null;
  notices: ChaosNotice[];
  specialVictorySeat: SeatId | null;
  wildOptions: Card[];
  frozenSeats: SeatId[];
};

export type AbilityActivation = {
  abilityId: ChaosAbilityId;
  targetSeat?: SeatId;
  cardId?: string;
  intoCardId?: string;
};
