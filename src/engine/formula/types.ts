import type { GameCalculation } from "../../data/formula-schema"
import type { ResolvedStats } from "../stats/types"

/** Everything a compiled `FormulaNode` closure needs to produce a number.
 * `rank` is 1-based (ability rank, or always 1 for item calcs). `dataValues`
 * arrays are indexed `[rank-1]`, clamped to the array's own bounds (Riot
 * repeats the last entry past max rank in several real calcs). */
export type EvalContext = {
  readonly stats: ResolvedStats
  readonly level: number
  readonly rank: number
  readonly dataValues: Readonly<Record<string, readonly number[]>>
  /** Per-step rank override (plan §5 `ComboStep.rankOverride`), scoped
   * narrowly: only set on the `EvalContext` passed to an action's own
   * `ActionComponent.compute` calls (`simulate.ts`'s `fireAction`), never on
   * the ctx exposed to `PassiveTriggerApi`/passive-rule effects — so a
   * step's rank override affects that *ability's* own damage formula
   * (via `bindings/helpers.ts`'s `withAbilityData`) without leaking into
   * unrelated passive calcs bound at a fixed rank (e.g. Brand's
   * `ExplosionDamage`, always rank 1 regardless of the triggering ability's
   * rank). */
  readonly rankOverride?: number
  /** Stack counts keyed by buff name, for `BuffCounterBy*` parts (e.g. Darius
   * bleed stacks, Riftmaker's eternity counter). */
  readonly buffCounters?: Readonly<Record<string, number>>
  /** Current resource (mana/energy) amount, for `AbilityResourceByCoefficient`. */
  readonly resourceCurrent?: number
  /** Epicness tier of every currently-equipped item, for `ByItemEpicnessCount`. */
  readonly equippedItemEpicness?: readonly number[]
  /** Resolves a sibling `GameCalculation` by name, for `spellCalculationRef`. */
  readonly resolveSpellCalculation?: (key: string) => GameCalculation | undefined
}

/** Thrown when a `FormulaNode` cannot be compiled — an `unknown` kind, an
 * unresolved stat id, or a named data value missing from the snapshot. Never
 * silently evaluates to 0 (plan §4.2 requirement). */
export class FormulaCompileError extends Error {
  readonly nodeKind: string

  constructor(message: string, nodeKind: string) {
    super(message)
    this.name = "FormulaCompileError"
    this.nodeKind = nodeKind
  }
}

export type CompiledFormula = (ctx: EvalContext) => number
