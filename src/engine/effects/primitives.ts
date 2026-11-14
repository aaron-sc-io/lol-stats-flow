import type { EvalContext } from "../formula/types"
import type {
  AmplifierEffect,
  DamageType,
  ExecuteEffect,
  PercentHpEffect,
  PercentHpVariant,
} from "./types"

export type TargetHpState = {
  readonly currentHp: number
  readonly maxHp: number
  readonly bonusHp: number
}

function hpForVariant(target: TargetHpState, variant: PercentHpVariant): number {
  switch (variant) {
    case "max":
      return target.maxHp
    case "current":
      return target.currentHp
    case "missing":
      return Math.max(0, target.maxHp - target.currentHp)
    case "bonus":
      return target.bonusHp
  }
}

/** Resolves a `PercentHp` effect's raw damage at the moment it fires —
 * always reads target HP state *at resolve time*, never pre-computed (plan
 * §4.4 requirement #4). */
export function resolvePercentHp(
  effect: PercentHpEffect,
  ctx: EvalContext,
  target: TargetHpState,
): number {
  const percent = effect.percentFormula(ctx)
  return percent * hpForVariant(target, effect.variant)
}

/** Resolves an `Execute` effect: below `thresholdPercent` current/max HP, the
 * execute formula applies instead of the normal formula. */
export function resolveExecute(
  effect: ExecuteEffect,
  ctx: EvalContext,
  target: TargetHpState,
): number {
  const currentPercent = target.maxHp > 0 ? target.currentHp / target.maxHp : 0
  return currentPercent <= effect.thresholdPercent
    ? effect.executeFormula(ctx)
    : effect.normalFormula(ctx)
}

/** Resolves an `Amplifier` effect into the multiplier (1 + percent) to apply
 * to a damage instance of the given type, honoring its scope. */
export function resolveAmplifierMultiplier(
  effect: AmplifierEffect,
  ctx: EvalContext,
  elapsedMs: number,
  damageType: DamageType,
  isOnHit: boolean,
): number {
  if (effect.scope === "abilityDamage" && (damageType === "true" || isOnHit)) {
    return 1
  }
  if (effect.scope === "onHitDamage" && !isOnHit) {
    return 1
  }
  return 1 + effect.percentFormula(ctx, elapsedMs)
}

export type StackCounterState = { readonly hits: number }

/** Pure every-Nth-hit trigger logic (Vayne W, Kraken Slayer). Returns the
 * updated hit count and whether this hit triggers the bonus effect. */
export function advanceStackCounter(
  state: StackCounterState,
  everyN: number,
): { readonly state: StackCounterState; readonly triggered: boolean } {
  const hits = state.hits + 1
  const triggered = hits % everyN === 0
  return { state: { hits: triggered ? 0 : hits }, triggered }
}

export type ResistStackState = { readonly stacks: number }

/** Pure stacking-reduction accumulator (Black Cleaver shred). Each
 * application adds one stack up to `maxStacks`; returns total flat
 * reduction = `flatPerStack * stacks`. */
export function applyResistReductionStack(
  state: ResistStackState,
  maxStacks: number,
): ResistStackState {
  return { stacks: Math.min(maxStacks, state.stacks + 1) }
}
