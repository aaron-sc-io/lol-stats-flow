import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildKit } from "../../kit"
import { simulate } from "../../sim/simulate"
import type { ComboStep, SimResult } from "../../sim/types"
import { loadSnapshotFixture } from "../../test-support/load-snapshot"

/** Yasuo damage validation: (a) Infinity Edge raises the crit multiplier,
 * (b) Last Breath makes later crits ignore 60% of bonus armor, and (c) Last
 * Whisper / Lord Dominik's Regards apply percent armor pen.
 *
 * The expected numbers come from `oracle()` below. It reads the raw snapshot
 * JSON directly and does its own math (stat growth, crit, pen, mitigation).
 * It imports nothing from `stats/`, `formula/`, or `mitigation/`. Only
 * `buildKit` + `simulate` produce the "actual" numbers. */

type RawItem = { name: string; stats: Record<string, number> }
type RawAbility = {
  dataValues: Record<string, number[]>
  calculations: Record<
    string,
    { parts: Array<{ kind: string; coefficient?: number; statKey?: string }> }
  >
}
type RawChampion = {
  name: string
  stats: { attackDamage: number; attackDamagePerLevel: number; critDamageMultiplier: number }
  abilities: Record<"Q" | "W" | "E" | "R", RawAbility>
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`snapshot missing ${what}`)
  return value
}

const dataRoot = join(process.cwd(), "data")
const { patch } = JSON.parse(readFileSync(join(dataRoot, "current.json"), "utf8")) as {
  patch: string
}
const rawChampions = JSON.parse(
  readFileSync(join(dataRoot, "snapshots", patch, "champions.json"), "utf8"),
) as RawChampion[]
const rawItems = JSON.parse(
  readFileSync(join(dataRoot, "snapshots", patch, "items.json"), "utf8"),
) as RawItem[]
const yasuo = need(
  rawChampions.find((c) => c.name === "Yasuo"),
  "Yasuo",
)
const dv = (ability: RawAbility, key: string, rank: number): number =>
  need(ability.dataValues[key]?.[rank], `${key}[${rank}]`)
const snapshot = loadSnapshotFixture()

const LEVEL = 11
const RANKS = { Q: 5, E: 5, R: 2 } as const
/** 100 total armor, 60 of it bonus, so bonus-only pen has something to hit.
 * HP is huge so nothing dies mid-combo and every hit resolves. */
const TARGET = {
  id: "dummy",
  name: "Dummy",
  maxHp: 100_000,
  bonusHp: 0,
  armor: 100,
  bonusArmor: 60,
  magicResist: 50,
}

/** Control combo has no R. The test combo puts R in the middle, so the crits
 * before R are a second control inside the same sim. */
const CONTROL_COMBO = ["E", "Q", "AA-crit", "Q-empowered", "AA"] as const
const R_COMBO = ["E", "Q", "AA-crit", "R", "AA-crit", "Q-empowered", "AA"] as const

const ITEM_SETS: Record<string, readonly string[]> = {
  base: [],
  IE: ["Infinity Edge"],
  LW: ["Last Whisper"],
  LDR: ["Lord Dominik's Regards"],
  "IE+LDR": ["Infinity Edge", "Lord Dominik's Regards"],
}

// ---------------------------------------------------------------------------
// Independent oracle (hand math against raw snapshot JSON)
// ---------------------------------------------------------------------------

type Oracle = {
  totalAD: number
  bonusAD: number
  critMult: number
  armorPenPct: number
  /** Expected post-mitigation damage per step, aligned with the combo. */
  steps: Array<{ action: string; raw: number; mitigated: number }>
}

function oracle(combo: readonly string[], itemNames: readonly string[]): Oracle {
  const items = itemNames.map((n) => {
    const item = rawItems.find((i) => i.name === n)
    if (item === undefined) throw new Error(`snapshot missing item ${n}`)
    return item
  })
  const s = yasuo.stats
  const n = LEVEL - 1
  const growth = n * (0.7025 + 0.0175 * n)
  const baseAD = s.attackDamage + s.attackDamagePerLevel * growth
  const bonusAD = items.reduce((a, i) => a + (i.stats.attackDamage ?? 0), 0)
  const totalAD = baseAD + bonusAD
  const ap = items.reduce((a, i) => a + (i.stats.abilityPower ?? 0), 0)
  const critMult =
    s.critDamageMultiplier + items.reduce((a, i) => a + (i.stats.criticalStrikeDamageBonus ?? 0), 0)
  const armorPenPct =
    1 - items.reduce((a, i) => a * (1 - (i.stats.armorPenetrationPercent ?? 0)), 1)

  const { Q, E, R } = yasuo.abilities
  const qBase = dv(Q, "BaseDamage", RANKS.Q)
  const qRatio = dv(Q, "ADRatio", RANKS.Q)
  const eDmg =
    dv(E, "BaseDamage", RANKS.E) +
    dv(E, "ADRatio", RANKS.E) * bonusAD +
    (E.dataValues.APRatio?.[RANKS.E] ?? 0) * ap
  const rCoef = need(
    R.calculations.Damage?.parts.find((p) => p.statKey === "attackDamage")?.coefficient,
    "R Damage AD coefficient",
  )
  const rDmg = dv(R, "RBaseDamage", RANKS.R) + rCoef * bonusAD
  const rBonusPen = dv(R, "RPercentArmorPen", RANKS.R) / 100

  // Armor split into base and bonus parts. Percent pen hits both parts; the
  // R bonus-only pen hits only the bonus part. Then 100 / (100 + armor).
  const physMult = (bonusPen: number): number => {
    const baseArmor = TARGET.armor - TARGET.bonusArmor
    const eff =
      baseArmor * (1 - armorPenPct) + TARGET.bonusArmor * (1 - armorPenPct) * (1 - bonusPen)
    return 100 / (100 + eff)
  }
  const magicMult = 100 / (100 + TARGET.magicResist)

  let rCast = false
  const steps = combo.map((action) => {
    const critPen = rCast ? rBonusPen : 0
    let raw: number
    let mitigated: number
    switch (action) {
      case "Q":
        raw = qBase + qRatio * totalAD
        mitigated = raw * physMult(0)
        break
      case "Q-empowered":
        // Snapshot TotalDamageCrit = BaseDamage + totalAD * (ADRatio * critMult)
        raw = qBase + qRatio * critMult * totalAD
        mitigated = raw * physMult(critPen)
        break
      case "E":
        raw = eDmg
        mitigated = raw * magicMult
        break
      case "R":
        raw = rDmg
        mitigated = raw * physMult(0)
        rCast = true
        break
      case "AA":
        raw = totalAD
        mitigated = raw * physMult(0)
        break
      case "AA-crit":
        raw = totalAD * critMult
        mitigated = raw * physMult(critPen)
        break
      default:
        throw new Error(`oracle: unhandled action ${action}`)
    }
    return { action, raw, mitigated }
  })
  return { totalAD, bonusAD, critMult, armorPenPct, steps }
}

// ---------------------------------------------------------------------------
// Engine ("actual") side
// ---------------------------------------------------------------------------

function runEngine(combo: readonly string[], itemNames: readonly string[]): SimResult {
  const kit = buildKit(snapshot, {
    championId: "Yasuo",
    level: LEVEL,
    items: itemNames,
    rankOverrides: RANKS,
  })
  const steps: ComboStep[] = combo.map((actionId, i) => ({
    id: `s${i}`,
    sourceId: "Yasuo",
    actionId,
  }))
  return simulate({ steps, kits: { Yasuo: kit }, target: TARGET })
}

type Row = {
  set: string
  combo: string
  step: string
  expected: number
  actual: number
  delta: number
  ok: boolean
}

const TOLERANCE = 1e-6
const rows: Row[] = []

function compare(
  setName: string,
  comboName: string,
  combo: readonly string[],
): {
  expected: Oracle
  actual: SimResult
} {
  const items = need(ITEM_SETS[setName], `item set ${setName}`)
  const expected = oracle(combo, items)
  const actual = runEngine(combo, items)
  expected.steps.forEach((step, i) => {
    const got = actual.perStep[`s${i}`] ?? Number.NaN
    const delta = got - step.mitigated
    rows.push({
      set: setName,
      combo: comboName,
      step: `${i}:${step.action}`,
      expected: Number(step.mitigated.toFixed(4)),
      actual: Number(got.toFixed(4)),
      delta: Number(delta.toFixed(6)),
      ok: Math.abs(delta) < TOLERANCE,
    })
  })
  const expTotal = expected.steps.reduce((a, s) => a + s.mitigated, 0)
  const actTotal = Object.values(actual.perStep).reduce((a, v) => a + v, 0)
  rows.push({
    set: setName,
    combo: comboName,
    step: "TOTAL",
    expected: Number(expTotal.toFixed(4)),
    actual: Number(actTotal.toFixed(4)),
    delta: Number((actTotal - expTotal).toFixed(6)),
    ok: Math.abs(actTotal - expTotal) < TOLERANCE,
  })
  return { expected, actual }
}

const results: Record<string, { expected: Oracle; actual: SimResult }> = {}
for (const setName of Object.keys(ITEM_SETS)) {
  results[`${setName}|control`] = compare(setName, "control", CONTROL_COMBO)
  results[`${setName}|R`] = compare(setName, "R", R_COMBO)
}
console.table(rows)

const result = (key: string) => need(results[key], `result ${key}`)

const mitigatedAt = (key: string, i: number): number =>
  results[key]?.actual.perStep[`s${i}`] ?? Number.NaN
const rawAt = (key: string, i: number): number =>
  results[key]?.actual.instances[i]?.raw ?? Number.NaN

describe("Yasuo damage validation — every step matches the independent oracle", () => {
  it.each(rows.map((r) => [`${r.set} / ${r.combo} / ${r.step}`, r] as const))("%s", (_, row) => {
    expect(row.actual).toBeCloseTo(row.expected, 4)
  })
})

describe("(a) Infinity Edge modifies the crit multiplier", () => {
  it("crit multiplier: base = snapshot critDamageMultiplier, IE adds criticalStrikeDamageBonus", () => {
    expect(result("base|control").expected.critMult).toBeCloseTo(2.0, 6)
    expect(result("IE|control").expected.critMult).toBeCloseTo(2.3, 6)
  })

  it("AA-crit / AA raw ratio is 2.0 without IE and 2.3 with IE", () => {
    // CONTROL_COMBO: index 2 = AA-crit, 4 = AA
    expect(rawAt("base|control", 2) / rawAt("base|control", 4)).toBeCloseTo(2.0, 6)
    expect(rawAt("IE|control", 2) / rawAt("IE|control", 4)).toBeCloseTo(2.3, 6)
  })

  it("Q-empowered (crit Steel Tempest) scales with IE's crit multiplier", () => {
    const qCritRatio = dv(yasuo.abilities.Q, "ADRatio", RANKS.Q)
    const qBase = dv(yasuo.abilities.Q, "BaseDamage", RANKS.Q)
    const ie = result("IE|control").expected
    expect(rawAt("IE|control", 3)).toBeCloseTo(qBase + qCritRatio * 2.3 * ie.totalAD, 4)
  })
})

describe("(b) Last Breath makes crits ignore 60% bonus armor", () => {
  it("post-R AA-crit deals more than the identical pre-R AA-crit in the same combo", () => {
    // R_COMBO: index 2 = AA-crit before R, 4 = AA-crit after R
    for (const set of Object.keys(ITEM_SETS)) {
      expect(rawAt(`${set}|R`, 4)).toBeCloseTo(rawAt(`${set}|R`, 2), 6)
      expect(mitigatedAt(`${set}|R`, 4)).toBeGreaterThan(mitigatedAt(`${set}|R`, 2))
    }
  })

  it("post-R damage equals the 100 / (100 + 40 + 60*0.4) armor case (base set)", () => {
    const raw = rawAt("base|R", 4)
    expect(mitigatedAt("base|R", 4)).toBeCloseTo(raw * (100 / (100 + 40 + 60 * 0.4)), 6)
  })

  it("non-crit AA after R is unaffected (same as control)", () => {
    // R_COMBO idx 6 = AA, CONTROL idx 4 = AA
    expect(mitigatedAt("base|R", 6)).toBeCloseTo(mitigatedAt("base|control", 4), 6)
  })

  it("Q-empowered after R beats Q-empowered in the no-R control", () => {
    // R_COMBO idx 5, CONTROL idx 3
    expect(mitigatedAt("base|R", 5)).toBeGreaterThan(mitigatedAt("base|control", 3))
  })
})

describe("(c) Last Whisper / Lord Dominik's Regards apply percent armor pen", () => {
  it("pen percent read from item stats: LW 18%, LDR 35%", () => {
    expect(result("LW|control").expected.armorPenPct).toBeCloseTo(0.18, 6)
    expect(result("LDR|control").expected.armorPenPct).toBeCloseTo(0.35, 6)
  })

  it("plain Q mitigated = raw * 100/(100 + 100*(1-pen))", () => {
    for (const [set, pen] of [
      ["base", 0],
      ["LW", 0.18],
      ["LDR", 0.35],
    ] as const) {
      const raw = rawAt(`${set}|control`, 1)
      expect(mitigatedAt(`${set}|control`, 1)).toBeCloseTo(raw * (100 / (100 + 100 * (1 - pen))), 4)
    }
  })

  it("magic damage (E) is not affected by armor pen", () => {
    const eRaw = rawAt("LDR|control", 0)
    expect(mitigatedAt("LDR|control", 0)).toBeCloseTo(eRaw * (100 / 150), 6)
  })

  it("LDR pen stacks with R's bonus-armor pen on post-R crits", () => {
    const raw = rawAt("LDR|R", 4)
    const eff = 40 * 0.65 + 60 * 0.65 * 0.4
    expect(mitigatedAt("LDR|R", 4)).toBeCloseTo(raw * (100 / (100 + eff)), 4)
  })
})
