import { describe, expect, it } from "vitest"
import { buildKit } from "../../kit"
import { simulate } from "../../sim/simulate"
import {
  calcOrThrow,
  findCoefficientFor,
  findRatioDataValueNameFor,
} from "../../test-support/calc-fields"
import { loadSnapshotFixture } from "../../test-support/load-snapshot"

/** Reference-evaluator suite for Brand (plan §3.3 item 2) — see
 * `reference/yasuo.test.ts` module doc comment for the general approach.
 * `__golden__/pinned/brand-blaze.test.ts` is the companion suite hand-
 * verified against a frozen patch. */
const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

describe("Brand reference — Q (Sear) scales with total AP per the calc's own coefficient", () => {
  it("Q at rank 3, level 7, no items: raw = SpellBaseDamage[3] (0 AP contribution)", () => {
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

  it("Q at rank 5, level 16, with Void Staff, vs 100 armor / 100 MR: raw = SpellBaseDamage[5] + coefficient*totalAP, mitigated by effective MR after the item's own magic pen %", () => {
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
    const base = brand.abilities.Q.dataValues.SpellBaseDamage?.[5] ?? 0
    const ratio =
      findCoefficientFor(calcOrThrow(brand.abilities.Q, "TotalDamage"), "abilityPower") ?? 0
    const expectedRaw = base + ratio * kit.ctx.stats.total.abilityPower
    expect(result.instances[0]?.raw).toBeCloseTo(expectedRaw)
    // Effective MR after Void Staff's own magic pen % (read from the item's
    // own stats, not hardcoded) — mitigated = raw / (1 + effectiveMR/100).
    const effectiveMr = 100 * (1 - kit.ctx.stats.total.magicPenetrationPercent)
    expect(result.instances[0]?.mitigated).toBeCloseTo(expectedRaw / (1 + effectiveMr / 100))
  })
})

describe("Brand reference — E (Conflagration) scales with total AP via a named ratio dataValue", () => {
  it("E at rank 4, level 9, with Rabadon's Deathcap: raw = BaseDamage[4] + APRatio[4]*totalAP", () => {
    const brand = snapshot.champions.find((c) => c.name === "Brand")
    if (brand === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Brand",
      level: 9,
      items: ["Rabadon's Deathcap"],
      rankOverrides: { E: 4 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Brand", actionId: "E" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const base = brand.abilities.E.dataValues.BaseDamage?.[4] ?? 0
    const ratioName = findRatioDataValueNameFor(
      calcOrThrow(brand.abilities.E, "EDamageCalc"),
      "abilityPower",
    )
    const ratio = ratioName === undefined ? 0 : (brand.abilities.E.dataValues[ratioName]?.[4] ?? 0)
    expect(result.instances[0]?.raw).toBeCloseTo(base + ratio * kit.ctx.stats.total.abilityPower)
  })
})

describe("Brand golden — Blaze passive (detonation + ablaze burn), patch-agnostic", () => {
  it("Given 2 ablaze applications (Q then W), when simulated, then detonation does NOT fire (requires 3 stacks, not 2)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [
        { id: "q", sourceId: "Brand", actionId: "Q" },
        { id: "w", sourceId: "Brand", actionId: "W" },
      ],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    expect(result.instances.some((i) => i.label === "Blaze detonation")).toBe(false)
  })

  it("Given 3 ablaze applications (Q, W, E), when simulated, then detonation fires for magic damage = ExplosionDamage(fraction, interpolated by level) * target.maxHp", () => {
    const brand = snapshot.champions.find((c) => c.name === "Brand")
    if (brand === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [
        { id: "q", sourceId: "Brand", actionId: "Q" },
        { id: "w", sourceId: "Brand", actionId: "W" },
        { id: "e", sourceId: "Brand", actionId: "E" },
      ],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const detonation = result.instances.find((i) => i.label === "Blaze detonation")
    expect(detonation).toBeDefined()
    expect(detonation?.damageType).toBe("magic")
    // Reference-evaluator: recompute the fraction independently from the
    // ExplosionDamage calc's own byCharLevelInterpolation + statByCoefficient
    // parts, read as raw fields (not compiled) — linear interpolation by
    // level, scaled by the ×0.01 multiplier that turns the "6..12" number
    // into a fraction of max HP.
    const explosionCalc = calcOrThrow(brand.abilities.P, "ExplosionDamage")
    const interp = explosionCalc.parts.find((p) => p.kind === "byCharLevelInterpolation")
    if (interp === undefined || interp.kind !== "byCharLevelInterpolation") {
      throw new Error("ExplosionDamage no longer has a byCharLevelInterpolation part")
    }
    const t = (9 - interp.startLevel) / (interp.endLevel - interp.startLevel)
    const base = interp.startValue + t * (interp.endValue - interp.startValue)
    const apCoefficient = findCoefficientFor(explosionCalc, "abilityPower") ?? 0
    const multiplier =
      explosionCalc.multiplier?.kind === "number" ? explosionCalc.multiplier.value : 1
    const fraction = (base + apCoefficient * kit.ctx.stats.total.abilityPower) * multiplier
    expect(detonation?.raw).toBeCloseTo(fraction * 2000)
  })

  it("Given a single ablaze application, when all its ticks resolve, then total burn damage = PercentHealthDamage/100 of target max HP over the burn duration (1 stack)", () => {
    const brand = snapshot.champions.find((c) => c.name === "Brand")
    if (brand === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [{ id: "q", sourceId: "Brand", actionId: "Q" }],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const burnTicks = result.instances.filter((i) => i.label === "Ablaze" && i.isTick)
    expect(burnTicks.length).toBeGreaterThan(0)
    expect(burnTicks.every((i) => i.damageType === "magic")).toBe(true)
    const burnPercent = (brand.abilities.P.dataValues.PercentHealthDamage?.[0] ?? 2) / 100
    const total = burnTicks.reduce((sum, i) => sum + i.raw, 0)
    expect(total).toBeCloseTo(burnPercent * 2000, 0)
  })

  it("Given Q then W applied in quick succession, when simulated, then the burn DoT refreshes (one merged stream, not two parallel streams of ticks)", () => {
    const kit = buildKit(snapshot, { championId: "Brand", level: 9, items: [] })
    const result = simulate({
      steps: [
        { id: "q", sourceId: "Brand", actionId: "Q" },
        { id: "w", sourceId: "Brand", actionId: "W", delayMs: 100 },
      ],
      kits: { Brand: kit },
      target: dummy(2000, 0, 0),
    })
    const burnTickTimes = result.instances
      .filter((i) => i.label === "Ablaze" && i.isTick)
      .map((i) => i.time)
    expect(new Set(burnTickTimes).size).toBe(burnTickTimes.length)
  })
})
