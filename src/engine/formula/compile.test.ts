import { describe, expect, it } from "vitest"
import type { FormulaNode } from "../../data/formula-schema"
import type { ResolvedStats } from "../stats/types"
import { compile, compileCalculation } from "./compile"
import type { EvalContext } from "./types"
import { FormulaCompileError } from "./types"

function fixtureStats(overrides: Partial<ResolvedStats["total"]> = {}): ResolvedStats {
  return {
    level: 11,
    base: { health: 1000, armor: 50, magicResist: 40, attackDamage: 90, abilityPower: 0 },
    bonus: { health: 0, armor: 0, magicResist: 0, attackDamage: 60, abilityPower: 0 },
    total: {
      health: 1000,
      armor: 50,
      magicResist: 40,
      attackDamage: 150,
      abilityPower: 0,
      attackSpeed: 0.8,
      criticalStrikeChance: 0,
      criticalStrikeDamageMultiplier: 2,
      abilityHaste: 0,
      armorPenetrationFlat: 0,
      armorPenetrationPercent: 0,
      magicPenetrationFlat: 0,
      magicPenetrationPercent: 0,
      physicalLethality: 0,
      lifeSteal: 0,
      omnivamp: 0,
      ...overrides,
    },
    attackSpeedRatio: 0.65,
  }
}

function fixtureCtx(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    stats: fixtureStats(),
    level: 11,
    rank: 3,
    dataValues: { BaseDamage: [10, 20, 30, 40, 50], ADRatio: [0.8, 0.9, 1, 1.1, 1.2] },
    ...overrides,
  }
}

describe("compile — leaf nodes", () => {
  it("Given a number node, when compiled and evaluated, then it returns the constant", () => {
    expect(compile({ kind: "number", value: 42 })(fixtureCtx())).toBe(42)
  })

  it("Given a namedDataValue node, when evaluated, then it indexes dataValues by rank directly (index 0 = unlearned placeholder, per CDragon's real array shape)", () => {
    const node: FormulaNode = { kind: "namedDataValue", dataValue: "BaseDamage" }
    expect(compile(node)(fixtureCtx({ rank: 3 }))).toBe(40)
  })

  it("Given a rank beyond the data value array length, when evaluated, then it clamps to the last entry", () => {
    const node: FormulaNode = { kind: "namedDataValue", dataValue: "BaseDamage" }
    expect(compile(node)(fixtureCtx({ rank: 99 }))).toBe(50)
  })
})

describe("compile — stat-scaled nodes (matches Yasuo Q's real formula shape)", () => {
  it("Given statByNamedDataValue with stat=attackDamage/total, when evaluated, then it multiplies the data value by total AD", () => {
    const node: FormulaNode = {
      kind: "statByNamedDataValue",
      dataValue: "ADRatio",
      stat: 2,
      statKey: "attackDamage",
      statFormula: "total",
    }
    expect(compile(node)(fixtureCtx({ rank: 3 }))).toBeCloseTo(1.1 * 150)
  })

  it("Given statFormula=bonus, when evaluated, then it reads bonus AD only (not total) — Yasuo E's real shape", () => {
    const node: FormulaNode = {
      kind: "statByCoefficient",
      coefficient: 0.25,
      stat: 2,
      statKey: "attackDamage",
      statFormula: "bonus",
    }
    expect(compile(node)(fixtureCtx())).toBeCloseTo(0.25 * 60)
  })

  it("Given statBySubPart (Yasuo Q crit's real shape: AD * (ADRatio * critMultiplier)), when evaluated, then it multiplies the stat by the subpart's own value", () => {
    const node: FormulaNode = {
      kind: "statBySubPart",
      stat: 2,
      statKey: "attackDamage",
      statFormula: "total",
      subpart: {
        kind: "statByNamedDataValue",
        dataValue: "ADRatio",
        stat: 9,
        statKey: "criticalStrikeDamageMultiplier",
        statFormula: "total",
      },
    }
    // total AD (150) * (ADRatio[rank3]=1.1 * critMult(2)) = 330
    expect(compile(node)(fixtureCtx({ rank: 3 }))).toBeCloseTo(330)
  })
})

describe("compile — unresolved/unknown parts never silently return 0", () => {
  it("Given a statByCoefficient with statKey=null (unresolved mStat id), when compiled, then it throws FormulaCompileError immediately", () => {
    const node: FormulaNode = {
      kind: "statByCoefficient",
      coefficient: 1,
      stat: 999,
      statKey: null,
      statFormula: "total",
    }
    expect(() => compile(node)).toThrow(FormulaCompileError)
  })

  it("Given an unknown FormulaNode kind, when compiled, then it throws FormulaCompileError naming the raw type", () => {
    const node: FormulaNode = { kind: "unknown", type: "SomeFutureCalculationPart", raw: {} }
    expect(() => compile(node)).toThrow(/SomeFutureCalculationPart/)
  })

  it("Given a missing data value name, when evaluated, then it throws rather than returning 0", () => {
    const node: FormulaNode = { kind: "namedDataValue", dataValue: "DoesNotExist" }
    expect(() => compile(node)(fixtureCtx())).toThrow(FormulaCompileError)
  })
})

describe("compile — ByCharLevelBreakpoints (real Yasuo E shape)", () => {
  it("Given level1Value with decreasing breakpoints, when evaluated at a level past all breakpoints, then every additionalBonusAtThisLevel is applied cumulatively", () => {
    const node: FormulaNode = {
      kind: "byCharLevelBreakpoints",
      level1Value: 55,
      initialBonusPerLevel: 0,
      breakpoints: [
        { level: 7, additionalBonusAtThisLevel: -5 },
        { level: 13, additionalBonusAtThisLevel: -5 },
      ],
    }
    expect(compile(node)(fixtureCtx({ level: 6 }))).toBe(55)
    expect(compile(node)(fixtureCtx({ level: 7 }))).toBe(50)
    expect(compile(node)(fixtureCtx({ level: 18 }))).toBe(45)
  })

  it("Given a rate-change breakpoint (real Darius shape: mInitialBonusPerLevel + mBonusPerLevelAtAndAfter), when evaluated, then growth rate changes starting at the breakpoint's own level", () => {
    const node: FormulaNode = {
      kind: "byCharLevelBreakpoints",
      level1Value: 30,
      initialBonusPerLevel: 5,
      breakpoints: [
        { level: 11, bonusPerLevelAtAndAfter: 10 },
        { level: 14, bonusPerLevelAtAndAfter: 25 },
      ],
    }
    // levels 2-10: +5 each => 30 + 9*5 = 75 at level 10
    expect(compile(node)(fixtureCtx({ level: 10 }))).toBe(75)
    // level 11 uses new rate (10) already: 75 + 10 = 85
    expect(compile(node)(fixtureCtx({ level: 11 }))).toBe(85)
  })
})

describe("compile — ByCharLevelInterpolation (real Yasuo R shape)", () => {
  it("Given startValue/endValue scaled by stat progression, when evaluated at level 18, then it reaches endValue exactly", () => {
    const node: FormulaNode = {
      kind: "byCharLevelInterpolation",
      startValue: 125,
      endValue: 600,
      startLevel: 1,
      endLevel: 18,
      scaleByStatProgression: true,
    }
    expect(compile(node)(fixtureCtx({ level: 18 }))).toBeCloseTo(600)
    expect(compile(node)(fixtureCtx({ level: 1 }))).toBeCloseTo(125)
  })

  it("Given linear (non-progression) interpolation, when evaluated at the midpoint level, then it is the arithmetic midpoint", () => {
    const node: FormulaNode = {
      kind: "byCharLevelInterpolation",
      startValue: 0,
      endValue: 100,
      startLevel: 1,
      endLevel: 11,
      scaleByStatProgression: false,
    }
    expect(compile(node)(fixtureCtx({ level: 6 }))).toBeCloseTo(50)
  })
})

describe("compile — buff counters, resource, and item-epicness parts", () => {
  it("Given buffCounterByCoefficient, when evaluated, then it multiplies the coefficient by the named buff's stack count", () => {
    const node: FormulaNode = {
      kind: "buffCounterByCoefficient",
      buffName: "Stacks",
      coefficient: 5,
    }
    expect(compile(node)(fixtureCtx({ buffCounters: { Stacks: 3 } }))).toBe(15)
  })

  it("Given abilityResourceByCoefficient, when evaluated, then it multiplies the coefficient by the caster's current resource", () => {
    const node: FormulaNode = { kind: "abilityResourceByCoefficient", coefficient: 0.25 }
    expect(compile(node)(fixtureCtx({ resourceCurrent: 200 }))).toBe(50)
  })

  it("Given byItemEpicnessCount, when evaluated, then it counts equipped items at or above the epicness threshold", () => {
    const node: FormulaNode = { kind: "byItemEpicnessCount", coefficient: 2, epicness: 3 }
    expect(compile(node)(fixtureCtx({ equippedItemEpicness: [1, 3, 4, 2] }))).toBe(4)
  })
})

describe("compileCalculation", () => {
  it("Given a calculation with parts summed and a multiplier applied, when evaluated, then it matches (sum of parts) * multiplier", () => {
    const calc = {
      parts: [
        { kind: "number" as const, value: 10 },
        { kind: "number" as const, value: 20 },
      ],
      multiplier: { kind: "number" as const, value: 2 },
    }
    expect(compileCalculation(calc)(fixtureCtx())).toBe(60)
  })
})
