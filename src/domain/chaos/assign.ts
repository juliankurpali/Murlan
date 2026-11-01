import { RandomSource } from '../cards/random';
import { SeatId, SEATS } from '../game/types';
import { abilityDefinition, enabledAbilities } from './registry';
import { ChaosAbilityId, ChaosState, PlayerAbility } from './types';

function pickWeighted(pool: { id: ChaosAbilityId; weight: number }[], random: RandomSource): ChaosAbilityId | null {
  const total = pool.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
  if (total <= 0) {
    return null;
  }
  let ticket = random.next() * total;
  for (const row of pool) {
    ticket -= Math.max(0, row.weight);
    if (ticket < 0) {
      return row.id;
    }
  }
  return pool[pool.length - 1]?.id ?? null;
}

export type AssignAbilitiesOptions = {
  exclude?: ChaosAbilityId[];
  weights?: Partial<Record<ChaosAbilityId, number>>;
};

export function assignAbilities(
  random: RandomSource,
  seats: SeatId[] = SEATS,
  options: AssignAbilitiesOptions | ChaosAbilityId[] = [],
): ChaosState {
  const exclude = Array.isArray(options) ? options : (options.exclude ?? []);
  const weights = Array.isArray(options) ? undefined : options.weights;
  const taken: ChaosAbilityId[] = [];
  const abilities: ChaosState['abilities'] = [null, null, null, null];
  for (const seat of seats) {
    const pool = enabledAbilities([...exclude, ...taken]).map((row) => ({
      id: row.id,
      weight: weights?.[row.id] ?? row.weight,
    }));
    const id = pickWeighted(pool, random);
    if (!id) {
      continue;
    }
    taken.push(id);
    const definition = abilityDefinition(id);
    abilities[seat] = {
      seat,
      abilityId: id,
      remainingUses: definition.maxUses,
      consumed: false,
    };
  }
  return {
    abilities,
    freezeNext: [],
    peeks: [],
    specialVictorySeat: null,
    notices: [],
    wildSeq: 0,
  };
}

export function abilityAt(state: ChaosState, seat: SeatId): PlayerAbility | null {
  return state.abilities[seat] ?? null;
}
