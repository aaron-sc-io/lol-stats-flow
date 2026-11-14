/**
 * CDragon `mStat` enum → engine stat key table.
 *
 * Source of truth (verified, not guessed): the LoL Meta Wiki reverse-engineering
 * reference for `IGameCalculationPartWithStats.mStat`, which documents every
 * value shipped by Riot's client as of patch 16.x:
 * https://meta-wiki.leaguetoolkit.dev/classes/igamecalculationpartwithstats
 *
 * Cross-verified empirically against `raw.communitydragon.org/16.22/game/data/
 * characters/yasuo/yasuo.bin.json` → `YasuoQ1Wrapper.mSpell.mSpellCalculations`:
 * `TotalDamage` uses `mStat: 2` as the AD-ratio coefficient (consistent with
 * `Attack` = total attack damage), and `TotalDamageCrit` wraps a `mStat: 9`
 * sub-part as the crit multiplier (consistent with
 * `CriticalStrikeDamageMultiplier`, which equals the champion's
 * `critDamageMultiplier` field, 2.0 for Yasuo).
 *
 * Values 5, 13-16, 21 have no entry in Riot's own `GlobalStatsUIData.mStatUIData`
 * (per the same source) — they are recorded here as `null` (reserved/unused by
 * tooltip display, but the engine may still encounter them in a formula part).
 */
export const STAT_IDS: Readonly<Record<number, string | null>> = {
  0: "abilityPower",
  1: "armor",
  2: "attackDamage",
  3: "attackDamagePercent",
  4: "attackSpeed",
  5: null,
  6: "magicResist",
  7: "movementSpeed",
  8: "criticalStrikeChance",
  9: "criticalStrikeDamageMultiplier",
  10: "cooldownReduction",
  11: "abilityHaste",
  12: "health",
  13: null,
  14: null,
  15: null,
  16: null,
  17: "dodgeChance",
  18: "lifeSteal",
  19: "spellVamp",
  20: "omnivamp",
  21: null,
  22: "magicPenetrationFlat",
  23: "magicPenetrationPercent",
  24: "magicBonusPenetrationPercent",
  25: "magicLethality",
  26: "armorPenetrationFlat",
  27: "armorPenetrationPercent",
  28: "armorBonusPenetrationPercent",
  29: "physicalLethality",
  30: "tenacity",
  31: "attackRange",
  32: "healthRegen",
  33: "resourceRegen",
  34: "healShieldPower",
} as const

/** Which reading of the stat (`mStatFormula`) a calculation part requests. */
export const STAT_FORMULA_KINDS = ["total", "base", "bonus"] as const
export type StatFormulaKind = (typeof STAT_FORMULA_KINDS)[number]

export function statFormulaKindFromId(id: number): StatFormulaKind {
  return STAT_FORMULA_KINDS[id] ?? "total"
}

/** Resolves a numeric `mStat` id to the engine stat key, or `null` when the id
 * has no display mapping (reserved) or is entirely unrecognized (out of range
 * of documented values 0-34). Callers must preserve unresolved ids, never crash. */
export function resolveStatId(id: number): string | null {
  return STAT_IDS[id] ?? null
}
