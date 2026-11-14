import type { GameCalculation } from "../../data/formula-schema"
import type { AbilityData } from "../../data/snapshot-schema"

/** Narrow, hand-written field accessors over a `GameCalculation`'s raw
 * `parts` tree (plan §3.3 item 2: "independent hand-written evaluator ...
 * NOT reusing the engine compiler"). These read the calc's declarative
 * shape directly — which part kind, which stat, which coefficient, which
 * named dataValue series — without ever calling `formula/compile.ts`'s
 * `compile`/`compileCalculation`. Used by `__golden__/reference/*.test.ts`
 * to recompute expected damage from the CURRENT snapshot's own calc/
 * dataValue structure, so a routine balance-patch number change (e.g. a
 * coefficient bumped from 0.65 to 0.70) is picked up automatically instead
 * of needing a hardcoded constant updated by hand, while a structural
 * change (a part's kind flipped to `unknown`, a referenced dataValue
 * deleted) still diverges from what the engine actually computes. */

/** Looks up a named calc off an ability, throwing a clear error (rather than
 * returning `undefined`) if it's missing — reference tests are hand-written
 * against a specific calc name, so a missing name means the test itself is
 * stale, not that the mechanic should be silently skipped. */
export function calcOrThrow(ability: AbilityData, calcName: string): GameCalculation {
  const calc = ability.calculations[calcName]
  if (calc === undefined) {
    throw new Error(`reference test error: ability "${ability.name}" has no calc "${calcName}"`)
  }
  return calc
}

/** First `statByCoefficient` part matching `statKey`, if any — e.g. Brand
 * Q's `TotalDamage` has `{ kind: "statByCoefficient", coefficient: 0.65,
 * statKey: "abilityPower" }` as its AP-ratio term. */
export function findCoefficientFor(calc: GameCalculation, statKey: string): number | undefined {
  for (const part of calc.parts) {
    if (part.kind === "statByCoefficient" && part.statKey === statKey) {
      return part.coefficient
    }
  }
  return undefined
}

/** Name of the dataValue series driving a `statByNamedDataValue` (or
 * `statBySubPart` wrapping a flat `namedDataValue`) ratio term matching
 * `statKey` — e.g. Brand E's `EDamageCalc` has `{ kind:
 * "statByNamedDataValue", dataValue: "APRatio", statKey: "abilityPower" }`,
 * so the per-rank AP ratio is `dataValues.APRatio[rank]`. */
export function findRatioDataValueNameFor(
  calc: GameCalculation,
  statKey: string,
): string | undefined {
  for (const part of calc.parts) {
    if (part.kind === "statByNamedDataValue" && part.statKey === statKey) {
      return part.dataValue
    }
    if (
      part.kind === "statBySubPart" &&
      part.statKey === statKey &&
      part.subpart.kind === "namedDataValue"
    ) {
      return part.subpart.dataValue
    }
  }
  return undefined
}

/** Name of the first flat (non-stat-scaled) `namedDataValue` part — e.g.
 * Brand Q's `TotalDamage` has `{ kind: "namedDataValue", dataValue:
 * "SpellBaseDamage" }` as its flat base-damage term. */
export function findFlatDataValueName(calc: GameCalculation): string | undefined {
  for (const part of calc.parts) {
    if (part.kind === "namedDataValue") {
      return part.dataValue
    }
  }
  return undefined
}
