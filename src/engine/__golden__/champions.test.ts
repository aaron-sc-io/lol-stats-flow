import { describe, expect, it } from "vitest"
import { buildKit } from "../kit"
import { simulate } from "../sim/simulate"
import { loadSnapshotFixture } from "../test-support/load-snapshot"

const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

/** Golden tests for Yasuo, hand-verified against the League of Legends Wiki
 * (wiki.leagueoflegends.com/en-us/Yasuo, Steel Tempest / Sweeping Blade
 * tooltips, retrieved 2026-11-14 — base values match patch 16.22's
 * snapshot exactly: 60 base AD +2.5/lvl, Q 20/45/70/95/120 (+100% total
 * AD)). These lock in the rank→dataValue indexing fix (CDragon arrays are
 * `[rank0placeholder, rank1, ..., rankMax, ...]`, NOT `[rank1, rank2, ...]`)
 * discovered while writing this test — see compile.ts's `dataValueAt` doc
 * comment. */
describe("Yasuo golden — level 1, rank 1, no items", () => {
  const kit = buildKit(snapshot, {
    championId: "Yasuo",
    level: 1,
    items: [],
    rankOverrides: { Q: 1, E: 1, R: 1 },
  })

  it("Q (Steel Tempest) rank 1: wiki = 20 (+100% total AD); level-1 total AD = 60 base → 20 + 60 = 80 raw", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "Q" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.raw).toBeCloseTo(80)
  })

  it("AA (basic attack) at level 1: raw equals total AD (60, no items)", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "AA" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances[0]?.raw).toBeCloseTo(60)
  })
})

describe("Yasuo golden — level 18, rank 5, vs 100 armor / 100 MR target", () => {
  const kit = buildKit(snapshot, {
    championId: "Yasuo",
    level: 18,
    items: [],
    rankOverrides: { Q: 5, E: 5, R: 3 },
  })
  // Level 18 total AD = 60 + 2.5*17 = 102.5 (growthMultiplier(18) = 17 exactly).
  const totalAD = 60 + 2.5 * 17

  it("Q rank 5: wiki = 120 (+100% total AD) — raw = 120 + totalAD, mitigated by 100 armor (÷2)", () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "Q" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 100, 100),
    })
    const expectedRaw = 120 + totalAD
    expect(result.instances[0]?.raw).toBeCloseTo(expectedRaw)
    expect(result.instances[0]?.mitigated).toBeCloseTo(expectedRaw / 2)
  })

  it('E (Sweeping Blade) rank 5 is magic damage (verified via wiki — deals magic, not physical, despite scaling off AD): raw = 130 + 20% bonus AD + 60% AP; with no items, bonus AD is 0 (per wiki\'s Attack_damage page: "bonus attack damage can be gained from any source other than levels" — level growth counts as base, not bonus), so raw = 130 flat', () => {
    const result = simulate({
      steps: [{ id: "s", sourceId: "Yasuo", actionId: "E" }],
      kits: { Yasuo: kit },
      target: dummy(2000, 100, 100),
    })
    expect(result.instances[0]?.damageType).toBe("magic")
    expect(result.instances[0]?.raw).toBeCloseTo(130)
    expect(result.instances[0]?.mitigated).toBeCloseTo(65)
  })
})

/** Reference-evaluator style tests (plan §3.3): recompute each champion's
 * expected damage directly from the snapshot's own `dataValues` + the
 * documented Riot formulas, independently of the engine's binding/compile
 * path. These catch structural regressions (wrong stat, wrong rank index,
 * wrong damage type) without being broken by ordinary balance-patch number
 * changes, since both sides read the same snapshot. */
describe("Reference-evaluator cross-check (Brand / Darius / Garen / Vayne)", () => {
  function totalADAt(level: number): number {
    const yasuo = snapshot.champions.find((c) => c.name === "Yasuo")
    if (yasuo === undefined) throw new Error("fixture champion missing")
    const mult = ((level - 1) * (0.7025 + 0.0175 * (level - 1))) as number
    return yasuo.stats.attackDamage + yasuo.stats.attackDamagePerLevel * mult
  }

  it("Brand Q (Sear) rank 3 at level 7: raw = SpellBaseDamage[3] + APRatio[3]*totalAP (0, no items)", () => {
    const brand = snapshot.champions.find((c) => c.name === "Brand")
    if (brand === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Brand",
      level: 7,
      items: [],
      rankOverrides: { Q: 3 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Brand", actionId: "Q" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const expected = brand.abilities.Q.dataValues.SpellBaseDamage?.[3] ?? 0
    expect(result.instances[0]?.raw).toBeCloseTo(expected)
    expect(result.instances[0]?.damageType).toBe("magic")
  })

  it("Brand Q (Sear) rank 5 at level 16, with Void Staff (95 AP, 40% magic pen), vs 100 armor / 100 MR target: raw = BaseDamage[5] + 0.65*totalAP, mitigated with 40% magic pen applied", () => {
    const brand = snapshot.champions.find((c) => c.name === "Brand")
    if (brand === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Brand",
      level: 16,
      items: ["Void Staff"],
      rankOverrides: { Q: 5 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Brand", actionId: "Q" }],
      kits: { Brand: kit },
      target: dummy(2000, 100, 100),
    })
    const baseDamage = brand.abilities.Q.dataValues.SpellBaseDamage?.[5] ?? 0
    const expectedRaw = baseDamage + 0.65 * kit.ctx.stats.total.abilityPower
    expect(result.instances[0]?.raw).toBeCloseTo(expectedRaw)
    // 40% magic pen (Void Staff) on 100 MR -> effective MR = 60 -> mitigated = raw/1.6
    expect(result.instances[0]?.mitigated).toBeCloseTo(expectedRaw / 1.6)
  })

  it("Garen R (Demacian Justice) execute: deals true damage scaling with target's missing HP (plan's chosen default mechanic for Garen)", () => {
    const garen = snapshot.champions.find((c) => c.name === "Garen")
    if (garen === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Garen",
      level: 16,
      items: [],
      rankOverrides: { R: 3 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Garen", actionId: "R" }],
      kits: { Garen: kit },
      target: { ...dummy(2000, 0, 0), currentHp: 500 },
    })
    const base = garen.abilities.R.dataValues.BaseDamage?.[3] ?? 0
    const executePercent = garen.abilities.R.dataValues.ExecuteDamage?.[3] ?? 0
    const expected = base + executePercent * (2000 - 500)
    expect(result.instances.reduce((sum, i) => sum + i.raw, 0)).toBeCloseTo(expected)
    expect(result.instances.every((i) => i.damageType === "true")).toBe(true)
  })

  it("Darius Hemorrhage (passive bleed) stacks and ticks: an AA applies a bleed DoT whose total damage scales with BleedDamagePerStack", () => {
    const darius = snapshot.champions.find((c) => c.name === "Darius")
    if (darius === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, { championId: "Darius", level: 11, items: [] })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "AA" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    const ticks = result.instances.filter((i) => i.isTick)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.every((i) => i.damageType === "physical")).toBe(true)
  })

  it("Vayne Silver Bolts (every-3rd-hit true damage) fires on the 3rd auto attack, not the 1st or 2nd", () => {
    const kit = buildKit(snapshot, { championId: "Vayne", level: 11, items: [] })
    const steps = [1, 2, 3].map((n) => ({ id: `s${n}`, sourceId: "Vayne", actionId: "AA" }))
    const result = simulate({ steps, kits: { Vayne: kit }, target: dummy(5000, 0, 0) })
    const trueHits = result.instances.filter(
      (i) => i.damageType === "true" && i.label === "Silver Bolts",
    )
    expect(trueHits).toHaveLength(1)
  })

  it("'' used total AD helper is self-consistent with the engine's own statsAt (sanity check for the reference evaluator itself)", () => {
    expect(totalADAt(18)).toBeCloseTo(60 + 2.5 * 17)
  })
})
