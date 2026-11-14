/**
 * Resolved combat stats for a champion at a given level with a given item
 * set — the shape every engine formula/effect reads from. Only the stats
 * that matter for damage math get a base/bonus/total split; cosmetic-only
 * stats (move speed, mana, attack range) are tracked as `total` only.
 */
export type SplitStatKey = "health" | "armor" | "magicResist" | "attackDamage" | "abilityPower"

export type FlatOnlyStatKey =
  | "attackSpeed"
  | "criticalStrikeChance"
  | "criticalStrikeDamageMultiplier"
  | "abilityHaste"
  | "armorPenetrationFlat"
  | "armorPenetrationPercent"
  | "magicPenetrationFlat"
  | "magicPenetrationPercent"
  | "physicalLethality"
  | "lifeSteal"
  | "omnivamp"

export type ResolvedStats = {
  readonly level: number
  readonly base: Readonly<Record<SplitStatKey, number>>
  readonly bonus: Readonly<Record<SplitStatKey, number>>
  readonly total: Readonly<Record<SplitStatKey, number>> & Readonly<Record<FlatOnlyStatKey, number>>
  /** Riot's `attackSpeedRatioModifiable` — exposed for callers that need the
   * raw growth ratio (e.g. display); the engine's AS formula already bakes
   * it into `total.attackSpeed` via the same model `statCalculator.js` used. */
  readonly attackSpeedRatio: number
}

export function totalOf(stats: ResolvedStats, key: SplitStatKey): number {
  return stats.base[key] + stats.bonus[key]
}

const ZERO_SPLIT: Readonly<Record<SplitStatKey, number>> = {
  health: 0,
  armor: 0,
  magicResist: 0,
  attackDamage: 0,
  abilityPower: 0,
}

export function zeroSplit(): Record<SplitStatKey, number> {
  return { ...ZERO_SPLIT }
}
