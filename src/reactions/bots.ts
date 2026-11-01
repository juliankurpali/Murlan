import { REACTION_IDS, type ReactionId } from './catalog';
import type { ReactionOccupant } from './service';

export const BOT_REACTION_MIN_MS = 8000;
export const BOT_REACTION_MAX_MS = 18000;

export type BotReactionPick = {
  senderId: string;
  targetPlayerId: string;
  reactionId: ReactionId;
  requestId: string;
};

export function nextBotReactionDelay(random: () => number = Math.random): number {
  return BOT_REACTION_MIN_MS + Math.floor(random() * (BOT_REACTION_MAX_MS - BOT_REACTION_MIN_MS + 1));
}

export function pickBotReaction(
  occupants: ReactionOccupant[],
  botIds: Iterable<string>,
  random: () => number = Math.random,
): BotReactionPick | null {
  const bots = new Set(botIds);
  const senders = occupants.filter((row) => bots.has(row.id));
  if (senders.length === 0 || occupants.length < 2) {
    return null;
  }
  const sender = senders[Math.floor(random() * senders.length)];
  if (!sender) {
    return null;
  }
  const humans = occupants.filter((row) => !bots.has(row.id) && row.id !== sender.id);
  const anyone = occupants.filter((row) => row.id !== sender.id);
  const pool = humans.length > 0 && random() < 0.6 ? humans : anyone;
  const target = pool[Math.floor(random() * pool.length)];
  const reactionId = REACTION_IDS[Math.floor(random() * REACTION_IDS.length)];
  if (!target || !reactionId) {
    return null;
  }
  const requestId = `botrx${Math.floor(random() * 1e9).toString(36)}${Math.floor(random() * 1e9).toString(36)}`.slice(
    0,
    16,
  );
  return {
    senderId: sender.id,
    targetPlayerId: target.id,
    reactionId,
    requestId,
  };
}
