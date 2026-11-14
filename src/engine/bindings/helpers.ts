import type { AbilityData } from "../../data/snapshot-schema"
import { compileCalculation } from "../formula/compile"
import type { CompiledFormula, EvalContext } from "../formula/types"
import type { ResolvedStats } from "../stats/types"

/** Compiles one named `GameCalculation` off an ability, throwing a clear
 * error (never silent 0) if the snapshot doesn't have it — bindings are
 * hand-authored against a specific patch's calc names, so a missing name
 * means the binding is stale, not that damage should be 0. */
export function compileAbilityCalc(ability: AbilityData, calcName: string): CompiledFormula {
  const calc = ability.calculations[calcName]
  if (calc === undefined) {
    throw new Error(
      `Binding error: ability "${ability.name}" has no calculation "${calcName}" (available: ${Object.keys(ability.calculations).join(", ")})`,
    )
  }
  return compileCalculation(calc)
}

export function abilityEvalContext(
  stats: ResolvedStats,
  level: number,
  rank: number,
  ability: AbilityData,
): EvalContext {
  return { stats, level, rank, dataValues: ability.dataValues }
}

/** Binds a compiled formula to one specific ability's `dataValues` and rank,
 * regardless of what `dataValues`/`rank` the caller's `EvalContext` carries.
 * Necessary because every ability on a champion reuses generic data-value
 * names ("BaseDamage", "APRatio", ...) with per-ability arrays — a
 * component must always read its *own* ability's arrays, not whichever
 * ability built the kit's base context. */
export function withAbilityData(
  ability: AbilityData,
  rank: number,
  formula: CompiledFormula,
): CompiledFormula {
  return (ctx) => formula({ ...ctx, dataValues: ability.dataValues, rank })
}

/** Standard max-rank-by-level order (plan §1 "Ability ranks" default):
 * Q/W/E unlock in the usual 1-2-1-2 pattern, R at 6/11/16. Returns the rank
 * (1-based, clamped to `maxRank`) a slot would have at a given champion
 * level under the conventional max-first leveling order used for defaults. */
export function defaultRankAtLevel(
  slot: "Q" | "W" | "E" | "R",
  level: number,
  maxRank: number,
): number {
  if (slot === "R") {
    return Math.min(maxRank, level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0) || 1
  }
  // Roughly: a non-ultimate ability goes up every other level once it's
  // been picked, reaching max rank around level 9-ish in a max-first order.
  // This is a reasonable default a combo step can always override.
  const rank = Math.ceil(Math.min(level, maxRank * 2) / 2)
  return Math.max(1, Math.min(maxRank, rank))
}
