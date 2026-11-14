import type { CompiledFormula, EvalContext } from "../formula/types"

export type DamageType = "physical" | "magic" | "true"

/** The fixed effect-primitive set (plan §4.3). Each binding composes these
 * to describe one champion ability / item passive-active. All percent/flat
 * amounts are themselves `CompiledFormula`s so they can read ranks, stacks,
 * and stats like any other damage component. */

export type HitEffect = {
  readonly kind: "hit"
  readonly damageType: DamageType
  readonly canCrit: boolean
  readonly formula: CompiledFormula
}

export type OnHitEffect = {
  readonly kind: "onHit"
  readonly damageType: DamageType
  readonly formula: CompiledFormula
}

export type DotEffect = {
  readonly kind: "dot"
  readonly damageType: DamageType
  readonly tickIntervalMs: number
  readonly durationMs: number
  /** Per-tick damage formula (already divided by tick count upstream if the
   * source data value is a *total* over the duration). */
  readonly perTickFormula: CompiledFormula
}

export type PercentHpVariant = "max" | "current" | "missing" | "bonus"

export type PercentHpEffect = {
  readonly kind: "percentHp"
  readonly damageType: DamageType
  readonly variant: PercentHpVariant
  /** Evaluates to the percent (0-1) to apply against the target HP variant,
   * read at resolve time against current target state. */
  readonly percentFormula: CompiledFormula
}

export type ExecuteEffect = {
  readonly kind: "execute"
  readonly damageType: DamageType
  /** Target HP% (0-1, current/max) below which the bonus formula applies
   * instead of the normal formula. */
  readonly thresholdPercent: number
  readonly normalFormula: CompiledFormula
  readonly executeFormula: CompiledFormula
}

export type AmplifierScope = "allDamage" | "abilityDamage" | "onHitDamage"

export type AmplifierEffect = {
  readonly kind: "amplifier"
  readonly scope: AmplifierScope
  /** Evaluated at apply-time; returns a multiplier added to 1 (e.g. 0.1 = +10%). */
  readonly percentFormula: (ctx: EvalContext, elapsedMs: number) => number
}

export type ResistReductionEffect = {
  readonly kind: "resistReduction"
  readonly resistType: "armor" | "magicResist"
  readonly flat: number
  readonly stacking: boolean
  readonly maxStacks: number
}

export type StackCounterEffect = {
  readonly kind: "stackCounter"
  readonly buffName: string
  /** Every Nth hit triggers `onTrigger` (e.g. Vayne W every 3rd, Kraken Slayer). */
  readonly everyN: number
}

export type SpellbladeEffect = {
  readonly kind: "spellblade"
  readonly formula: CompiledFormula
  readonly cooldownMs: number
}

export type Effect =
  | HitEffect
  | OnHitEffect
  | DotEffect
  | PercentHpEffect
  | ExecuteEffect
  | AmplifierEffect
  | ResistReductionEffect
  | StackCounterEffect
  | SpellbladeEffect
