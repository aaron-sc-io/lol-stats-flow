import type { AbilityData } from "../../data/snapshot-schema"
import { compileCalculation } from "../formula/compile"
import type { CompiledFormula, EvalContext } from "../formula/types"
import type { ResolvedStats } from "../stats/types"

/** Basic-attack cast time (time between AAs), used as every champion
 * binding's `AA`/`AA-crit` `castTimeMs`.
 *
 * Investigated per plan §4.4's "use attack windup if CDragon has it, else
 * keep 1000/AS and document": the bin DOES carry windup data — a live
 * fetch of `characters/yasuo/yasuo.bin.json` (retrieved 2026-11-14) shows
 * `CharacterRecords/Root.basicAttack` = `{ "mAttackDelayCastOffsetPercent":
 * -0.08, "mAttackDelayCastOffsetPercentAttackSpeedRatio": 1.0,
 * "mAttackProbability": 1.0 }`. That field only shifts *when inside the
 * attack's total duration* the damage/cast point lands (a negative
 * percent-of-attack-duration offset applied to the animation, per
 * League's AS-formula docs, e.g. https://leagueoflegends.fandom.com/wiki/
 * Attack_speed — "Cast Time" vs "Total Time"); it does NOT change the
 * *period between attacks*, which is fixed by `1 / attacksPerSecond =
 * 1000 / attackSpeed` regardless of how the single attack's own windup is
 * split. Per-step combo timing in this engine only needs the former (when
 * the next action can fire), not sub-attack animation phasing, so
 * `1000 / attackSpeed` remains the correct model — not a residual gap,
 * just not yet exposed in the snapshot schema (`mAttackDelayCastOffsetPercent`
 * isn't normalized) since nothing here needs it. Not normalizing/fetching
 * it keeps the data pipeline unchanged. */
export function basicAttackCastTimeMs(stats: ResolvedStats): number {
  return 1000 / Math.max(0.01, stats.total.attackSpeed)
}

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
 * ability built the kit's base context.
 *
 * `ctx.rankOverride` (set narrowly by `simulate.ts`'s `fireAction` from
 * `ComboStep.rankOverride`, only on the ctx passed to the firing action's
 * own components) wins over the closed-over `rank` when present, making a
 * per-step rank override effective at fire time without affecting any
 * other ability's or passive's fixed rank (e.g. passives bound via
 * `withAbilityData(p, 1, ...)` never see an override meant for a Q/W/E/R
 * action, since `rankOverride` is never copied onto `PassiveTriggerApi`'s
 * ctx). */
export function withAbilityData(
  ability: AbilityData,
  rank: number,
  formula: CompiledFormula,
): CompiledFormula {
  return (ctx) =>
    formula({ ...ctx, dataValues: ability.dataValues, rank: ctx.rankOverride ?? rank })
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
