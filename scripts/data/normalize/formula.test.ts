import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildCalculationMap, buildFormulaNode, buildGameCalculation } from "./formula"
import type { HashTable } from "./hash-resolver"

const FIXTURES_DIR = join(import.meta.dirname, "..", "__fixtures__")

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8"))
}

const emptyHashes: HashTable = new Map()

describe("buildCalculationMap — Yasuo Q (real trimmed CDragon fixture)", () => {
  const fixture = loadFixture("yasuo-q-trimmed.json")
  const spell = (fixture.mSpell as Record<string, unknown>).mSpellCalculations
  const calculations = buildCalculationMap(spell, emptyHashes)

  it("Given TotalDamage's raw mFormulaParts, when normalized, then it matches the exact expected FormulaNode tree", () => {
    expect(calculations.TotalDamage).toEqual({
      parts: [
        { kind: "namedDataValue", dataValue: "BaseDamage" },
        {
          kind: "statByNamedDataValue",
          dataValue: "ADRatio",
          stat: 2,
          statKey: "attackDamage",
          statFormula: "total",
        },
      ],
    })
  })

  it("Given TotalDamageCrit's nested StatBySubPart, when normalized, then the crit multiplier (mStat 9) is preserved in the subpart", () => {
    expect(calculations.TotalDamageCrit).toEqual({
      parts: [
        { kind: "namedDataValue", dataValue: "BaseDamage" },
        {
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
        },
      ],
      precision: 1,
    })
  })
})

describe("buildFormulaNode — unknown part preservation", () => {
  it("Given a part type this normalizer does not recognize, when built, then it becomes an unknown node with raw preserved rather than throwing", () => {
    const raw = { __type: "SomeFuturePartType", mSomeField: 42 }
    const node = buildFormulaNode(raw, emptyHashes)
    expect(node).toEqual({ kind: "unknown", type: "SomeFuturePartType", raw })
  })
})

describe("buildFormulaNode — ByCharLevelBreakpointsCalculationPart (real Yasuo shape)", () => {
  it("Given mLevel1Value + mBreakpoints with mAdditionalBonusAtThisLevel, when built, then fields map 1:1 and breakpoints stay sorted ascending", () => {
    const raw = {
      __type: "ByCharLevelBreakpointsCalculationPart",
      mLevel1Value: 55,
      mBreakpoints: [
        { mLevel: 13, mAdditionalBonusAtThisLevel: -5, __type: "Breakpoint" },
        { mLevel: 7, mAdditionalBonusAtThisLevel: -5, __type: "Breakpoint" },
      ],
    }
    const node = buildFormulaNode(raw, emptyHashes)
    expect(node).toEqual({
      kind: "byCharLevelBreakpoints",
      level1Value: 55,
      initialBonusPerLevel: 0,
      breakpoints: [
        { level: 7, additionalBonusAtThisLevel: -5 },
        { level: 13, additionalBonusAtThisLevel: -5 },
      ],
    })
  })
})

describe("buildFormulaNode — ByCharLevelInterpolationCalculationPart (real Yasuo shape)", () => {
  it("Given mStartValue/mEndValue/mScaleByStatProgressionMultiplier, when built, then defaults startLevel=1/endLevel=18", () => {
    const raw = {
      __type: "ByCharLevelInterpolationCalculationPart",
      mStartValue: 125,
      mEndValue: 600,
      mScaleByStatProgressionMultiplier: true,
    }
    const node = buildFormulaNode(raw, emptyHashes)
    expect(node).toEqual({
      kind: "byCharLevelInterpolation",
      startValue: 125,
      endValue: 600,
      startLevel: 1,
      endLevel: 18,
      scaleByStatProgression: true,
    })
  })
})

describe("buildFormulaNode — unresolved hash preservation", () => {
  it("Given a __type that is an unresolved CDragon hash token, when built, then the hash string is preserved verbatim as the unknown type", () => {
    const raw = { __type: "{deadbeef}", mX: 1 }
    const node = buildFormulaNode(raw, emptyHashes)
    expect(node).toEqual({ kind: "unknown", type: "{deadbeef}", raw })
  })

  it("Given a hash table that resolves the token, when built, then the resolved name is used as the kind lookup (still falls back to unknown if not a known kind name)", () => {
    const hashes: HashTable = new Map([["deadbeef", "SomeFutureCalculationPart"]])
    const raw = { __type: "{deadbeef}", mX: 1 }
    const node = buildFormulaNode(raw, hashes)
    expect(node).toEqual({ kind: "unknown", type: "SomeFutureCalculationPart", raw })
  })
})

describe("buildGameCalculation — item-level calculation with hashed __type wrapper", () => {
  it("Given Black Cleaver's mItemCalculations.MSBonusSplit, when normalized, then mFormulaParts are parsed regardless of the wrapper's own (hashed) __type", () => {
    const fixture = loadFixture("black-cleaver-trimmed.json")
    const raw = (fixture.mItemCalculations as Record<string, unknown>).MSBonusSplit as Record<
      string,
      unknown
    >
    const calc = buildGameCalculation(raw, emptyHashes)
    expect(calc).toEqual({ parts: [{ kind: "namedDataValue", dataValue: "MoveSpeedBonus" }] })
  })
})
