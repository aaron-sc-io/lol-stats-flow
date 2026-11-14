import type { ComboAction, Kit, ResolvedStats } from "@/engine"

/** Shared test-only fixtures for `src/graph/*.test.ts` files that need a
 * minimal but fully-typed `Kit`/`ResolvedStats` without pulling in the real
 * snapshot + formula compiler (that's what `kit-cache.test.ts` and the
 * engine's own golden tests are for). */

export const ZERO_STATS: ResolvedStats = {
  level: 1,
  base: { health: 0, armor: 0, magicResist: 0, attackDamage: 0, abilityPower: 0 },
  bonus: { health: 0, armor: 0, magicResist: 0, attackDamage: 0, abilityPower: 0 },
  total: {
    health: 0,
    armor: 0,
    magicResist: 0,
    attackDamage: 0,
    abilityPower: 0,
    attackSpeed: 0,
    criticalStrikeChance: 0,
    criticalStrikeDamageMultiplier: 1.75,
    abilityHaste: 0,
    armorPenetrationFlat: 0,
    armorPenetrationPercent: 0,
    magicPenetrationFlat: 0,
    magicPenetrationPercent: 0,
    physicalLethality: 0,
    lifeSteal: 0,
    omnivamp: 0,
  },
  attackSpeedRatio: 1,
}

export function fixtureAction(
  overrides: Partial<ComboAction> & { readonly id: string },
): ComboAction {
  return {
    label: overrides.id,
    keyLabel: overrides.id,
    slot: "Q",
    damageType: "physical",
    modeled: true,
    castTimeMs: 250,
    rank: 1,
    forceCrit: false,
    components: [],
    ...overrides,
  }
}

export function fixtureKit(
  overrides: Partial<Kit> & { readonly actions: readonly ComboAction[] },
): Kit {
  return {
    sourceId: "fixture-source",
    championId: "Yasuo",
    level: 11,
    ctx: { stats: ZERO_STATS, level: 11, rank: 1, dataValues: {} },
    passiveTriggers: [],
    ...overrides,
  }
}
