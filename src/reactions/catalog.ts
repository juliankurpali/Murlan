export const REACTION_IDS = [
  'piggy',
  'lol',
  'clown',
  'crown',
  'skull',
  'fire',
  'heart',
  'kiss',
  'cool',
  'sparkle',
] as const;
export type ReactionId = (typeof REACTION_IDS)[number];

export type ReactionNameKey =
  | 'reactionPiggy'
  | 'reactionLol'
  | 'reactionClown'
  | 'reactionCrown'
  | 'reactionSkull'
  | 'reactionFire'
  | 'reactionHeart'
  | 'reactionKiss'
  | 'reactionCool'
  | 'reactionSparkle';

export type ReactionDefinition = {
  id: ReactionId;
  assetKey: string;
  glyph: string;
  durationMs: number;
  nameKey: ReactionNameKey;
};

export const REACTION_DURATION_MS = 2500;
export const REACTION_COOLDOWN_MS = 2000;
export const REACTION_VISIBLE_MAX = 3;

export const REACTIONS: ReactionDefinition[] = [
  { id: 'piggy', assetKey: 'reaction_piggy', glyph: '🐷', durationMs: REACTION_DURATION_MS, nameKey: 'reactionPiggy' },
  { id: 'lol', assetKey: 'reaction_lol', glyph: '😂', durationMs: REACTION_DURATION_MS, nameKey: 'reactionLol' },
  { id: 'clown', assetKey: 'reaction_clown', glyph: '🤡', durationMs: REACTION_DURATION_MS, nameKey: 'reactionClown' },
  { id: 'crown', assetKey: 'reaction_crown', glyph: '👑', durationMs: REACTION_DURATION_MS, nameKey: 'reactionCrown' },
  { id: 'skull', assetKey: 'reaction_skull', glyph: '💀', durationMs: REACTION_DURATION_MS, nameKey: 'reactionSkull' },
  { id: 'fire', assetKey: 'reaction_fire', glyph: '🔥', durationMs: REACTION_DURATION_MS, nameKey: 'reactionFire' },
  { id: 'heart', assetKey: 'reaction_heart', glyph: '❤️', durationMs: REACTION_DURATION_MS, nameKey: 'reactionHeart' },
  { id: 'kiss', assetKey: 'reaction_kiss', glyph: '😘', durationMs: REACTION_DURATION_MS, nameKey: 'reactionKiss' },
  { id: 'cool', assetKey: 'reaction_cool', glyph: '😎', durationMs: REACTION_DURATION_MS, nameKey: 'reactionCool' },
  { id: 'sparkle', assetKey: 'reaction_sparkle', glyph: '✨', durationMs: REACTION_DURATION_MS, nameKey: 'reactionSparkle' },
];

const BY_ID = new Map(REACTIONS.map((item) => [item.id, item]));

export function isReactionId(value: string): value is ReactionId {
  return BY_ID.has(value as ReactionId);
}

export function reactionOf(id: ReactionId): ReactionDefinition {
  return BY_ID.get(id) ?? REACTIONS[0]!;
}
