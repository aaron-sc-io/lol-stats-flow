import { describe, expect, it } from "vitest"
import { buildKit } from "../../kit"
import { simulate } from "../../sim/simulate"
import { calcOrThrow, findCoefficientFor } from "../../test-support/calc-fields"
import { loadSnapshotFixture } from "../../test-support/load-snapshot"

/** Reference-evaluator suite for Darius (plan §3.3 item 2) — see
 * `reference/yasuo.test.ts` module doc comment for the general approach.
 * `__golden__/pinned/darius.test.ts` is the companion suite hand-verified
 * against a frozen patch. Q's blade/handle ratio is read directly off
 * `Q.dataValues.TotalADRatio` (not a calc) — the binding itself bypasses
 * the compiled `BladeDamage`/`HandleDamage` calcs because CDragon ships
 * them as tooltip-helper templates that always evaluate to a constant (see
 * `bindings/darius.ts` doc comment), so this reference test mirrors that
 * same documented Riot formula rather than the (intentionally unused)
 * compiled calc. */
const snapshot = loadSnapshotFixture()
const dummy = (maxHp: number, armor: number, magicResist: number) => ({
  id: "dummy",
  name: "Dummy",
  maxHp,
  armor,
  magicResist,
  bonusHp: 0,
})

describe("Darius reference — Q (Decimate) blade/handle scale with totalAD per dataValues", () => {
  it("blade/handle at rank 4, level 9, with Black Cleaver: handle is exactly 35% of blade, blade = BaseDamage[4] + (TotalADRatio[4]/100)*totalAD", () => {
    const darius = snapshot.champions.find((c) => c.name === "Darius")
    if (darius === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Darius",
      level: 9,
      items: ["Black Cleaver"],
      rankOverrides: { Q: 4 },
    })
    const blade = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "Q-blade" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    const handle = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "Q-handle" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    const base = darius.abilities.Q.dataValues.BaseDamage?.[4] ?? 0
    const ratio = (darius.abilities.Q.dataValues.TotalADRatio?.[4] ?? 0) / 100
    const expectedBlade = base + ratio * kit.ctx.stats.total.attackDamage
    expect(blade.instances[0]?.raw).toBeCloseTo(expectedBlade)
    expect(handle.instances[0]?.raw).toBeCloseTo(expectedBlade * 0.35)
  })
})

describe("Darius reference — W (Crippling Strike) empowered AA scales with totalAD per dataValues", () => {
  it("W at rank 3, level 11: raw = ADRatio[3] * totalAD", () => {
    const darius = snapshot.champions.find((c) => c.name === "Darius")
    if (darius === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Darius",
      level: 11,
      items: [],
      rankOverrides: { W: 3 },
    })
    const result = simulate({
      steps: [{ id: "s", sourceId: "Darius", actionId: "W" }],
      kits: { Darius: kit },
      target: dummy(2000, 0, 0),
    })
    const ratio = darius.abilities.W.dataValues.ADRatio?.[3] ?? 0
    expect(result.instances[0]?.raw).toBeCloseTo(ratio * kit.ctx.stats.total.attackDamage)
  })
})

describe("Darius reference — R (Noxian Guillotine) execute scales with stored Hemorrhage stacks", () => {
  it("R at rank 2 with 3 Hemorrhage stacks (from 3 AAs first): raw = (RBaseDamage[2] + coefficient*bonusAD) * (1 + 3*RDamagePercentPerHemoStack[2])", () => {
    const darius = snapshot.champions.find((c) => c.name === "Darius")
    if (darius === undefined) throw new Error("fixture missing")
    const kit = buildKit(snapshot, {
      championId: "Darius",
      level: 11,
      items: ["Black Cleaver"],
      rankOverrides: { R: 2 },
    })
    const steps = [
      { id: "a1", sourceId: "Darius", actionId: "AA" },
      { id: "a2", sourceId: "Darius", actionId: "AA", delayMs: 50 },
      { id: "a3", sourceId: "Darius", actionId: "AA", delayMs: 100 },
      { id: "r", sourceId: "Darius", actionId: "R", delayMs: 150 },
    ]
    const result = simulate({ steps, kits: { Darius: kit }, target: dummy(5000, 0, 0) })
    const rHit = result.instances.find((i) => i.label === "Noxian Guillotine (R)")
    const base = darius.abilities.R.dataValues.RBaseDamage?.[2] ?? 0
    const ratio = findCoefficientFor(calcOrThrow(darius.abilities.R, "Damage"), "attackDamage") ?? 0
    const stackPercent = darius.abilities.R.dataValues.RDamagePercentPerHemoStack?.[2] ?? 0
    const expected = (base + ratio * kit.ctx.stats.bonus.attackDamage) * (1 + 3 * stackPercent)
    expect(rHit?.raw).toBeCloseTo(expected)
    expect(rHit?.damageType).toBe("true")
  })
})

describe("Darius reference — Hemorrhage (passive bleed) is structural: fires, stacks, ticks as physical", () => {
  it("an AA applies a bleed DoT that ticks as physical damage", () => {
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
})
