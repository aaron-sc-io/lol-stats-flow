import type { FormulaNode, GameCalculation } from "../../data/formula-schema"
import type { ResolvedStats, SplitStatKey } from "../stats/types"
import type { CompiledFormula, EvalContext } from "./types"
import { FormulaCompileError } from "./types"

const SPLIT_STAT_KEYS: ReadonlySet<string> = new Set([
  "health",
  "armor",
  "magicResist",
  "attackDamage",
  "abilityPower",
])

function statValue(
  stats: ResolvedStats,
  statKey: string,
  formula: "total" | "base" | "bonus",
): number {
  if (SPLIT_STAT_KEYS.has(statKey)) {
    const key = statKey as SplitStatKey
    if (formula === "base") return stats.base[key]
    if (formula === "bonus") return stats.bonus[key]
    return stats.total[key]
  }
  const value = (stats.total as Record<string, number>)[statKey]
  if (value === undefined) {
    throw new FormulaCompileError(`Unknown stat key "${statKey}"`, "statByX")
  }
  return value
}

/** CDragon's `DataValues` arrays are indexed by rank directly, with index 0
 * reserved for a "rank 0" (unlearned) placeholder and index N = rank N —
 * verified against the live snapshot: Yasuo Q's `BaseDamage` is
 * `[-5, 20, 45, 70, 95, 120, 145]` and the wiki's Steel Tempest base damage
 * by rank is 20/45/70/95/120 (https://wiki.leagueoflegends.com/en-us/
 * Yasuo#Steel_Tempest), matching indices 1-5, NOT 0-4. */
function dataValueAt(ctx: EvalContext, name: string): number {
  const series = ctx.dataValues[name]
  if (series === undefined || series.length === 0) {
    throw new FormulaCompileError(`Missing data value "${name}"`, "namedDataValue")
  }
  const index = Math.min(series.length - 1, Math.max(0, ctx.rank))
  const value = series[index]
  if (value === undefined) {
    throw new FormulaCompileError(
      `Missing data value "${name}" at rank ${ctx.rank}`,
      "namedDataValue",
    )
  }
  return value
}

/** `ByCharLevelBreakpointsCalculationPart` algorithm, verified against real
 * Yasuo/Brand/Darius/Garen bin data and the reverse-engineered semantics in
 * https://github.com/WordlessMeteor/LoL-DIY-Programs (commit 4ced6f1): the
 * rate (`initialBonusPerLevel`) applies starting level 2; a breakpoint's own
 * level already uses its (possibly new) `bonusPerLevelAtAndAfter` rate, and a
 * breakpoint without that field freezes growth from that level on; distinct
 * from (and additive with) a one-time `additionalBonusAtThisLevel` bump. */
function evalByCharLevelBreakpoints(
  node: Extract<FormulaNode, { kind: "byCharLevelBreakpoints" }>,
  level: number,
): number {
  let value = node.level1Value
  let rate = node.initialBonusPerLevel
  const byLevel = new Map(node.breakpoints.map((bp) => [bp.level, bp]))
  for (let currentLevel = 2; currentLevel <= level; currentLevel++) {
    const bp = byLevel.get(currentLevel)
    if (bp?.bonusPerLevelAtAndAfter !== undefined) {
      rate = bp.bonusPerLevelAtAndAfter
    }
    value += rate
    if (bp?.additionalBonusAtThisLevel !== undefined) {
      value += bp.additionalBonusAtThisLevel
    }
  }
  return value
}

function evalByCharLevelInterpolation(
  node: Extract<FormulaNode, { kind: "byCharLevelInterpolation" }>,
  level: number,
): number {
  const clampedLevel = Math.min(node.endLevel, Math.max(node.startLevel, level))
  const span = node.endLevel - node.startLevel
  if (span <= 0) {
    return node.startValue
  }
  let t: number
  if (node.scaleByStatProgression) {
    const progression = (n: number) => {
      const k = n - 1
      return k * (0.7025 + 0.0175 * k)
    }
    const denom = progression(node.endLevel)
    t = denom === 0 ? 0 : progression(clampedLevel) / denom
  } else {
    t = (clampedLevel - node.startLevel) / span
  }
  return node.startValue + t * (node.endValue - node.startValue)
}

/** Compiles a `FormulaNode` into a pure function of `EvalContext`. Throws
 * `FormulaCompileError` immediately (not lazily) for an `unknown` node — the
 * engine never silently returns 0 for an unsupported mechanic. */
export function compile(node: FormulaNode): CompiledFormula {
  switch (node.kind) {
    case "number": {
      const v = node.value
      return () => v
    }
    case "namedDataValue":
      return (ctx) => dataValueAt(ctx, node.dataValue)
    case "effectValue":
      throw new FormulaCompileError("effectValue parts are not supported by this engine", node.kind)
    case "statByNamedDataValue": {
      if (node.statKey === null) {
        throw new FormulaCompileError(`Unresolved mStat id ${node.stat}`, node.kind)
      }
      const statKey = node.statKey
      const formula = node.statFormula
      return (ctx) => dataValueAt(ctx, node.dataValue) * statValue(ctx.stats, statKey, formula)
    }
    case "statByCoefficient": {
      if (node.statKey === null) {
        throw new FormulaCompileError(`Unresolved mStat id ${node.stat}`, node.kind)
      }
      const statKey = node.statKey
      const formula = node.statFormula
      const coefficient = node.coefficient
      return (ctx) => coefficient * statValue(ctx.stats, statKey, formula)
    }
    case "statBySubPart": {
      if (node.statKey === null) {
        throw new FormulaCompileError(`Unresolved mStat id ${node.stat}`, node.kind)
      }
      const statKey = node.statKey
      const formula = node.statFormula
      const sub = compile(node.subpart)
      return (ctx) => statValue(ctx.stats, statKey, formula) * sub(ctx)
    }
    case "sumOfSubParts": {
      const parts = node.subparts.map(compile)
      return (ctx) => parts.reduce((acc, fn) => acc + fn(ctx), 0)
    }
    case "productOfSubParts": {
      const parts = node.subparts.map(compile)
      return (ctx) => parts.reduce((acc, fn) => acc * fn(ctx), 1)
    }
    case "maxOfSubParts": {
      const parts = node.subparts.map(compile)
      return (ctx) => Math.max(...parts.map((fn) => fn(ctx)))
    }
    case "minOfSubParts": {
      const parts = node.subparts.map(compile)
      return (ctx) => Math.min(...parts.map((fn) => fn(ctx)))
    }
    case "clampSubParts": {
      const parts = node.subparts.map(compile)
      const { floor, ceiling } = node
      return (ctx) => {
        const sum = parts.reduce((acc, fn) => acc + fn(ctx), 0)
        const withFloor = floor !== undefined ? Math.max(floor, sum) : sum
        return ceiling !== undefined ? Math.min(ceiling, withFloor) : withFloor
      }
    }
    case "spellCalculationRef":
      return (ctx) => {
        const calc = ctx.resolveSpellCalculation?.(node.calculationKey)
        if (calc === undefined) {
          throw new FormulaCompileError(
            `Cannot resolve spellCalculationRef "${node.calculationKey}"`,
            node.kind,
          )
        }
        return compileCalculation(calc)(ctx)
      }
    case "byCharLevelInterpolation":
      return (ctx) => evalByCharLevelInterpolation(node, ctx.level)
    case "byCharLevelBreakpoints":
      return (ctx) => evalByCharLevelBreakpoints(node, ctx.level)
    case "byCharLevelFormula": {
      const values = node.values
      return (ctx) => {
        const index = Math.min(values.length - 1, Math.max(0, ctx.level - 1))
        return values[index] ?? 0
      }
    }
    case "buffCounterByNamedDataValue":
      return (ctx) => dataValueAt(ctx, node.dataValue) * (ctx.buffCounters?.[node.buffName] ?? 0)
    case "buffCounterByCoefficient":
      return (ctx) => node.coefficient * (ctx.buffCounters?.[node.buffName] ?? 0)
    case "abilityResourceByCoefficient":
      return (ctx) => node.coefficient * (ctx.resourceCurrent ?? 0)
    case "byItemEpicnessCount": {
      const threshold = node.epicness
      const coefficient = node.coefficient
      return (ctx) =>
        coefficient * (ctx.equippedItemEpicness ?? []).filter((e) => e >= threshold).length
    }
    case "cooldownMultiplier":
      // No observed fields on this part in the modeled roster (see
      // FormulaNode doc comment); treated as a neutral identity multiplier.
      return () => 1
    case "unknown":
      throw new FormulaCompileError(`Unknown FormulaNode kind "${node.type}"`, node.kind)
  }
}

/** Compiles a full `GameCalculation` (sum of parts, times optional multiplier). */
export function compileCalculation(calc: GameCalculation): CompiledFormula {
  const parts = calc.parts.map(compile)
  const multiplier = calc.multiplier !== undefined ? compile(calc.multiplier) : null
  return (ctx) => {
    const sum = parts.reduce((acc, fn) => acc + fn(ctx), 0)
    return multiplier !== null ? sum * multiplier(ctx) : sum
  }
}
